/**
 * EL PUENTE ENTRE LA PIZARRA DE ABP Y EL LABORATORIO (25/10/2026).
 *
 * «Que en nuestra pizarra todas las acciones tengan la opción de llevarlas
 * al laboratorio… y desde ahí diseñar variantes y alternativas, y enviarlas a
 * la pizarra como una slide nueva o modificación de una existente con todos
 * los jugadores y textos puestos».
 *
 * Son dos modelos distintos:
 *
 * - La pizarra (`lib/abp/pizarra.ts`) es una diapositiva de 1920×1080 con la
 *   FOTO de un campo en perspectiva: fichas en píxeles, puestos de una
 *   plantilla, flechas por fases (`lib/abp/trazos.ts`), rivales dibujados,
 *   consignas y rótulos.
 * - El laboratorio (`lib/abp-lab/modelo.ts`) es medio campo en METROS: papeles
 *   con salida, fin de carrera y fase, el recorrido del balón y la idea.
 *
 * **Los píxeles se pasan a metros con la cámara de cada foto** (`CAMARAS`):
 * una homografía de plano sacada de las líneas blancas de las dos fotos
 * (`public/abp-campo-ancho.png` y `abp-campo-porteria.png`), con la portería
 * arriba. Error medido en las líneas: menos de un píxel de la foto.
 *
 * **Ida y vuelta sin perder nada.** Al traer una diapositiva se guarda en la
 * rutina (`pizarra`, ver `puente-tipos.ts`) la diapositiva entera tal cual y
 * la FIRMA en metros de cada papel. Al devolverla se parte de lo guardado y
 * sólo se recalcula lo que el laboratorio ha cambiado: un papel que no se ha
 * movido vuelve a su píxel exacto con sus flechas encadenadas, y lo que el
 * laboratorio no sabe pintar (puestos, rótulos reescritos, rivales, guion)
 * vuelve intacto. Lo prueba `scripts/prueba-puente-pizarra.cjs`.
 *
 * Todo es puro: lo usan la pizarra, el laboratorio y la prueba.
 */

import {
  PLANTILLA_BY_KEY,
  enElCampo,
  gruposDe,
  siglaDe,
  type FichaPizarra,
  type GuionConsigna,
  type PuestoAbp,
  type SlidePizarra,
  type TableroPizarra,
  type VistaCampo,
} from "@/lib/abp/pizarra";
import { huellaRivales, huellaTrazos, nuevoTrazo, recorridoDe, type FaseTrazo, type TipoTrazo, type TrazoPizarra } from "@/lib/abp/trazos";
import { recorridoBalon, salidas } from "@/lib/abp-lab/campo";
import { MAX_ROLES, type Fase, type Lado, type Papel, type Punto, type Rol, type Rutina, type Zona } from "@/lib/abp-lab/modelo";
import type { ExtraPizarra, FichaGuardada, FirmaRol, OrigenPizarra } from "@/lib/abp-lab/puente-tipos";
import type { TipoAbp } from "@/lib/abp-lab/referentes";

/** Una rutina con o sin guardar (el borrador del estudio tiene la misma forma). */
export type RutinaPuente = Omit<Rutina, "id" | "creadaEn" | "actualizadaEn"> & { id?: string };

/* ------------------------------------------------------------------ */
/*  LA CÁMARA DE CADA FOTO                                             */
/* ------------------------------------------------------------------ */

/**
 * Cómo pinta cada foto el campo.
 *
 * `iw/ih` es el tamaño real del PNG y `ox,oy,w,h` el rectángulo que ocupa en
 * el lienzo (`VISTAS` de `lib/abp/pizarra.ts`). Dentro de la foto, con `X`
 * de banda a banda e `Y` desde la línea de gol (metros):
 *
 *   d = 1 + c·Y,   u = cx + (X − 34)·s0 / d,   v = (a·Y + v0) / d
 *
 * La cámara mira de frente a la portería, así que basta con cinco números.
 * Medidos sobre las líneas de la foto: línea de gol, área pequeña (5,5 m),
 * punto de penalti (11 m), frontal (16,5 m) y las dos bandas.
 */
type Camara = { iw: number; ih: number; ox: number; oy: number; w: number; h: number; cx: number; s0: number; v0: number; a: number; c: number };

const CAMARAS: Record<VistaCampo, Camara> = {
  ancho: { iw: 1283, ih: 719, ox: 0, oy: 0, w: 1920, h: 1080, cx: 622.5, s0: 13.79, v0: 146.6, a: 7.258, c: -0.00878 },
  porteria: { iw: 1052, ih: 719, ox: 5, oy: -2, w: 1576, h: 1080, cx: 510.5, s0: 11.31, v0: 146.6, a: 7.258, c: -0.00878 },
};

/** Del lienzo de la pizarra (px) a metros del laboratorio, sin recortar. */
export function aMetros(vista: VistaCampo, p: Punto): Punto {
  const k = CAMARAS[vista] ?? CAMARAS.ancho;

  const u = ((p.x - k.ox) * k.iw) / k.w;

  const v = ((p.y - k.oy) * k.ih) / k.h;

  const y = (v - k.v0) / (k.a - k.c * v);

  const d = 1 + k.c * y;

  return { x: 34 + ((u - k.cx) * d) / k.s0, y };
}

/** De metros al lienzo de la pizarra, en píxeles enteros. */
export function aLienzo(vista: VistaCampo, m: Punto): Punto {
  const k = CAMARAS[vista] ?? CAMARAS.ancho;

  /* Más allá de 60 m la cámara se da la vuelta: no hay nada que pintar ahí. */
  const y = Math.min(60, Math.max(-15, m.y));

  const d = 1 + k.c * y;

  const u = k.cx + ((m.x - 34) * k.s0) / d;

  const v = (k.a * y + k.v0) / d;

  return { x: Math.round(k.ox + (u * k.w) / k.iw), y: Math.round(k.oy + (v * k.h) / k.ih) };
}

/** Igual que `metro` de `modelo.ts`: un decimal y dentro del medio campo. */
const metro = (n: number, max: number) => Math.round(Math.min(max, Math.max(0, n)) * 10) / 10;

const enMetros = (vista: VistaCampo, p: Punto): Punto => {
  const m = aMetros(vista, p);

  return { x: metro(m.x, 68), y: metro(m.y, 52.5) };
};

/* Recorta y quita espacios por los dos lados: así el servidor (`texto`) no lo cambia y la firma sigue valiendo. */
const limpia = (s: string, max: number) => s.trim().slice(0, max).trim();

/* ------------------------------------------------------------------ */
/*  PAPELES, ZONAS Y TIPO                                              */
/* ------------------------------------------------------------------ */

const sinTildes = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function papelPorTexto(lado: Lado, texto: string): Papel | null {
  const t = sinTildes(texto);

  if (!t.trim()) return null;

  if (lado === "ofensivo") {
    if (/remat/.test(t)) return "rematador";
    if (/bloque/.test(t)) return "bloqueador";
    if (/rechace|segunda|2ª|finaliz/.test(t)) return "segunda";
    if (/portero/.test(t)) return "portero";
    if (/ejecut|lanzad|tirador|penalti|saca/.test(t)) return "lanzador";
    if (/corta|corto/.test(t)) return "corto";
    if (/equilibr|zaguero|defensa|cierra|vigil|atras/.test(t)) return "vigilancia";
    if (/senuelo|arrastr/.test(t)) return "senuelo";

    return null;
  }

  if (/marca|hombre/.test(t)) return "marcador";
  if (/corta|corto/.test(t)) return "corto";
  if (/descolg|arriba|contra|transic|salida/.test(t)) return "vigilancia";
  if (/rechace|segunda|2ª|frontal/.test(t)) return "segunda";
  if (/zona|barrera|suelo|palo|area|banda/.test(t)) return "zonal";

  return null;
}

/** El papel de una ficha: por su puesto, luego por la caja en que va, luego por cómo se mueve. */
function papelDe(lado: Lado, puesto: PuestoAbp | null, grupo: string, trazo?: TipoTrazo): Papel {
  if (trazo === "bloqueo" && lado === "ofensivo") return "bloqueador";

  return papelPorTexto(lado, puesto?.label ?? "") ?? papelPorTexto(lado, grupo) ?? (lado === "ofensivo" ? "rematador" : "marcador");
}

/** La zona del laboratorio que corresponde a un sitio (el primer palo es el del lado del balón). */
function zonaDe(m: Punto | undefined, papel: Papel, golpeo: Punto | undefined): Zona {
  if (!m) return papel === "lanzador" || papel === "corto" ? "corto" : papel === "vigilancia" ? "atras" : "centro";

  if (m.y > 25) return "atras";

  if (m.y > 12.5) return "frontal";

  if ((m.x < 10 || m.x > 58) && m.y < 12) return "corto";

  if (Math.abs(m.x - 34) < 4 && m.y < 2.5 && papel === "portero") return "portero";

  const izquierdaPrimero = (golpeo?.x ?? 0) <= 34;

  if (m.x < 32) return izquierdaPrimero ? "primer-palo" : "segundo-palo";

  if (m.x > 36) return izquierdaPrimero ? "segundo-palo" : "primer-palo";

  return "centro";
}

function tipoDe(plantilla: string, golpeo: Punto | undefined): TipoAbp {
  if (plantilla.startsWith("corner")) return "corner";

  if (plantilla.startsWith("falta") || plantilla === "directas") return "falta";

  if (plantilla.startsWith("banda")) return "banda";

  if (golpeo) {
    if (golpeo.y < 3 && (golpeo.x < 4 || golpeo.x > 64)) return "corner";

    if (golpeo.x < 1.5 || golpeo.x > 66.5) return "banda";

    if (golpeo.y > 15) return "falta";
  }

  return "corner";
}

/** «CÓRNER OFENSIVO» → «Córner ofensivo». */
function capitaliza(titulo: string) {
  const t = titulo.toLocaleLowerCase("es");

  return t.charAt(0).toLocaleUpperCase("es") + t.slice(1);
}

/* ------------------------------------------------------------------ */
/*  TEXTOS                                                             */
/* ------------------------------------------------------------------ */

const PREFIJO_RUTINA = "Rutina: ";

const PREFIJO_INTENCION = "Intención: ";

/** Las consignas (y la rutina e intención del guion) como la idea de la rutina. */
export function ideaDeSlide(notas: string[], guion?: GuionConsigna) {
  const lineas: string[] = [];

  if (guion?.rutina?.trim()) lineas.push(PREFIJO_RUTINA + guion.rutina.trim());

  if (guion?.intencion?.trim()) lineas.push(PREFIJO_INTENCION + guion.intencion.trim());

  lineas.push(...notas.map((n) => n.trim()).filter(Boolean));

  return limpia(lineas.join("\n"), 1200);
}

/** Al revés: cada línea de la idea es una consigna; las que empiezan por «Rutina:»/«Intención:» van al guion. */
export function consignasDeIdea(idea: string): { notas: string[]; rutina?: string; intencion?: string } {
  const notas: string[] = [];

  let rutina: string | undefined;

  let intencion: string | undefined;

  for (const bruta of idea.split(/\r?\n/)) {
    const linea = bruta.trim();

    if (!linea) continue;

    if (linea.startsWith(PREFIJO_RUTINA) && rutina === undefined) rutina = linea.slice(PREFIJO_RUTINA.length).trim();
    else if (linea.startsWith(PREFIJO_INTENCION) && intencion === undefined) intencion = linea.slice(PREFIJO_INTENCION.length).trim();
    else notas.push(linea);
  }

  return { notas: notas.slice(0, 20), ...(rutina ? { rutina } : {}), ...(intencion ? { intencion } : {}) };
}

/* ------------------------------------------------------------------ */
/*  HUELLA DE UNA DIAPOSITIVA                                          */
/* ------------------------------------------------------------------ */

/* FNV-1a de 32 bits, dos pasadas con semillas distintas: 16 caracteres. */
function resumen(texto: string) {
  const pasada = (semilla: number) => {
    let h = semilla >>> 0;

    for (let i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }

    return h.toString(16).padStart(8, "0");
  };

  return pasada(0x811c9dc5) + pasada(0x01234567);
}

/**
 * Lo que se ve de una diapositiva, sin ids: si cambia, alguien la ha tocado
 * en la pizarra desde que se trajo.
 */
export function huellaSlide(slide: SlidePizarra) {
  return resumen(
    JSON.stringify([
      slide.plantilla,
      slide.titulo,
      slide.vista,
      slide.notas,
      slide.guion ?? null,
      slide.textos ?? null,
      slide.fichas.map((f) => [f.playerId, f.puesto, Math.round(f.x), Math.round(f.y)].join("|")).sort(),
      huellaTrazos(slide.trazos),
      huellaRivales(slide.rivales),
    ]),
  );
}

/* ------------------------------------------------------------------ */
/*  DE LA PIZARRA AL LABORATORIO                                       */
/* ------------------------------------------------------------------ */

/** El recorrido del balón: un punto por arranque y punta, en el orden de las fases. */
function balonDe(trazos: TrazoPizarra[], vista: VistaCampo): Punto[] | undefined {
  const envios = trazos.filter((t) => t.tipo === "balon").sort((a, b) => a.fase - b.fase);

  if (!envios.length) return undefined;

  const puntos: Punto[] = [];

  for (const t of envios) {
    const ultimo = puntos.at(-1);

    if (!ultimo || Math.hypot(ultimo.x - t.x1, ultimo.y - t.y1) > 3) puntos.push({ x: t.x1, y: t.y1 });

    puntos.push({ x: t.x2, y: t.y2 });
  }

  return puntos.slice(0, 6).map((p) => enMetros(vista, p));
}

export type EntradaPizarra = {
  slide: SlidePizarra;
  partidoId: string;
  rival: string;
  jornada?: string;
  fecha?: string;
  /** Para apuntar el nombre y el dorsal de cada ficha (los ids de la hoja se renumeran). */
  jugadores?: Map<string, { nombre: string; dorsal?: number }>;
  /** ISO de ahora (se pasa para que la función sea pura). */
  ahora: string;
};

/** Una diapositiva de la pizarra como rutina del laboratorio, con todo lo demás guardado aparte. */
export function rutinaDeSlide(e: EntradaPizarra): RutinaPuente {
  const { slide } = e;

  const plantilla = PLANTILLA_BY_KEY.get(slide.plantilla);

  const lado: Lado = plantilla?.lado ?? "ofensivo";

  const vista: VistaCampo = slide.vista === "porteria" ? "porteria" : "ancho";

  const trazos = (slide.trazos ?? []).slice(0, 120);

  const balon = balonDe(trazos, vista);

  const golpeo = balon?.[0];

  const puestos = new Map((plantilla?.puestos ?? []).map((p) => [p.key, p]));

  const grupos = new Map(gruposDe(slide).map((g) => [g.key, g.label]));

  const roles: Rol[] = [];

  const fichas: FichaGuardada[] = slide.fichas.slice(0, 40).map((f) => {
    const cadena = enElCampo(f) ? recorridoDe(f, trazos) : [];

    const primera = cadena[0];

    const puesto = f.puesto ? (puestos.get(f.puesto) ?? null) : null;

    const papel = papelDe(lado, puesto, puesto ? (grupos.get(puesto.grupo) ?? "") : "", primera?.tipo);

    const salida = enElCampo(f) ? enMetros(vista, f) : undefined;

    const meta = primera ? enMetros(vista, { x: primera.x2, y: primera.y2 }) : undefined;

    const nota = puesto ? limpia(`${siglaDe(puesto)} · ${puesto.label}`, 140) : "";

    const id = f.id.slice(0, 40);

    const rol: Rol = {
      jugador: limpia(f.playerId, 60),
      papel,
      zona: zonaDe(salida, papel, golpeo),
      ...(nota ? { nota } : {}),
      ...(salida ? { x: salida.x, y: salida.y } : {}),
      ...(meta && primera ? { hx: meta.x, hy: meta.y, fase: primera.fase as Fase } : {}),
      ref: id,
    };

    const enLab = roles.length < MAX_ROLES;

    if (enLab) roles.push(rol);

    const firma: FirmaRol = {
      jugador: rol.jugador,
      ...(rol.x !== undefined ? { x: rol.x, y: rol.y } : {}),
      ...(rol.hx !== undefined ? { hx: rol.hx, hy: rol.hy, fase: rol.fase } : {}),
    };

    const quien = e.jugadores?.get(f.playerId);

    return {
      id,
      playerId: f.playerId,
      puesto: f.puesto,
      x: f.x,
      y: f.y,
      ...(quien?.nombre ? { nombre: quien.nombre.slice(0, 60) } : {}),
      ...(quien?.dorsal !== undefined ? { dorsal: quien.dorsal } : {}),
      cadena: cadena.map((t) => t.id),
      enLab,
      firma,
    };
  });

  const nombre = limpia(`${capitaliza(slide.titulo || plantilla?.titulo || "Acción")}${e.rival.trim() ? ` · ${e.rival.trim()}` : ""}`, 80);

  const notas = slide.notas.slice(0, 20);

  const idea = ideaDeSlide(notas, slide.guion);

  const senal = limpia(slide.guion?.senal ?? "", 80);

  const extra: ExtraPizarra = {
    v: 1,
    vista,
    plantilla: slide.plantilla,
    titulo: slide.titulo,
    ...(slide.rev !== undefined ? { rev: slide.rev } : {}),
    notas: [...notas],
    ...(slide.textos ? { textos: JSON.parse(JSON.stringify(slide.textos)) } : {}),
    ...(slide.guion ? { guion: { ...slide.guion } } : {}),
    fichas,
    trazos: trazos.map((t) => ({ ...t })),
    rivales: (slide.rivales ?? []).slice(0, 30).map((r) => ({ ...r })),
    firma: { nombre, idea, senal, ...(balon ? { balon } : {}) },
    huella: huellaSlide(slide),
  };

  const origen: OrigenPizarra = {
    partidoId: e.partidoId,
    slideId: slide.id,
    titulo: slide.titulo,
    rival: e.rival,
    ...(e.jornada ? { jornada: e.jornada } : {}),
    ...(e.fecha ? { fecha: e.fecha } : {}),
    traidaEn: e.ahora,
  };

  return {
    nombre,
    tipo: tipoDe(slide.plantilla, golpeo),
    lado,
    contra: "cualquiera",
    senal,
    idea,
    roles,
    variantes: [],
    estado: "idea",
    ...(balon ? { balon } : {}),
    origen,
    pizarra: extra,
  };
}

/**
 * Trae otra vez de la pizarra una rutina que ya está en el laboratorio.
 *
 * Manda la pizarra en lo que tienen los dos (quién, dónde, carreras, balón,
 * consignas, señal); lo que sólo tiene el laboratorio se queda: el nombre, el
 * estado, el progreso, los usos, las variantes escritas, contra qué defensa,
 * el envío, y el papel, la zona y la nota de cada uno (por su ficha).
 */
export function fusionaDesdePizarra<T extends RutinaPuente>(existente: T, nueva: RutinaPuente): T {
  const previos = new Map(existente.roles.filter((r) => r.ref).map((r) => [r.ref as string, r]));

  const roles = nueva.roles.map((n) => {
    const v = n.ref ? previos.get(n.ref) : undefined;

    if (!v) return n;

    const { x: _x, y: _y, hx: _hx, hy: _hy, fase: _f, ...resto } = v;

    void _x;
    void _y;
    void _hx;
    void _hy;
    void _f;

    return {
      ...resto,
      jugador: n.jugador,
      ...(n.x !== undefined ? { x: n.x, y: n.y } : {}),
      ...(n.hx !== undefined ? { hx: n.hx, hy: n.hy, fase: n.fase } : {}),
      ref: n.ref,
    };
  });

  const pizarra = nueva.pizarra ? { ...nueva.pizarra, firma: { ...nueva.pizarra.firma, nombre: existente.nombre } } : existente.pizarra;

  const { balon: _b, ...sinBalon } = existente;

  void _b;

  return {
    ...sinBalon,
    roles,
    senal: nueva.senal,
    idea: nueva.idea,
    ...(nueva.balon ? { balon: nueva.balon } : {}),
    ...(nueva.origen ? { origen: nueva.origen } : {}),
    ...(pizarra ? { pizarra } : {}),
  } as T;
}

/* ------------------------------------------------------------------ */
/*  DEL LABORATORIO A LA PIZARRA                                       */
/* ------------------------------------------------------------------ */

const nuevoId = (prefijo: string) => `${prefijo}-${Math.random().toString(36).slice(2, 10)}`;

/** Mueve el arranque de los trazos `ids` que salen de `desde` (y su control a medias, como `arrastraTrazos`). */
function mueveArranque(trazos: TrazoPizarra[], ids: string[], desde: Punto, hasta: Punto) {
  const dx = hasta.x - desde.x;

  const dy = hasta.y - desde.y;

  if (!dx && !dy) return trazos;

  return trazos.map((t) =>
    ids.includes(t.id) && Math.hypot(t.x1 - desde.x, t.y1 - desde.y) <= 3
      ? {
          ...t,
          x1: t.x1 + dx,
          y1: t.y1 + dy,
          ...(t.cx !== undefined && t.cy !== undefined ? { cx: Math.round(t.cx + dx / 2), cy: Math.round(t.cy + dy / 2) } : {}),
        }
      : t,
  );
}

const faseDe = (n: number | undefined): FaseTrazo => (n === 1 || n === 3 ? n : 2);

/** El balón de la rutina como flechas de balón, conservando la fase de cada tramo si la había. */
function trazosDeBalon(puntos: Punto[], vista: VistaCampo, fases: number[]): TrazoPizarra[] {
  return puntos.slice(1).map((p, i) => nuevoTrazo("balon", faseDe(fases[i] ?? (i === 0 ? 2 : 3)), aLienzo(vista, puntos[i]), aLienzo(vista, p)));
}

const igualBalon = (a?: Punto[], b?: Punto[]) => JSON.stringify(a?.length ? a.map((p) => [p.x, p.y]) : null) === JSON.stringify(b?.length ? b.map((p) => [p.x, p.y]) : null);

export type OpcionesSlide = {
  /** El id de la diapositiva: el de la que se sustituye, o ninguno para una nueva. */
  id?: string;
  ahora: string;
};

/**
 * Una rutina como diapositiva de la pizarra, con todos los jugadores, sus
 * carreras, el balón y las consignas colocados.
 *
 * Si vino de la pizarra, se parte de la diapositiva guardada y sólo cambia lo
 * que se ha cambiado aquí. Si nació en el laboratorio, va en una «Pizarra
 * libre» con la foto que mejor la enseña (córner: campo ancho; el resto, el
 * plano de portería).
 */
export function slideDeRutina(r: RutinaPuente, o: OpcionesSlide): SlidePizarra {
  const slide = r.pizarra ? desdeLoGuardado(r, r.pizarra) : desdeCero(r);

  return {
    ...slide,
    id: o.id ?? nuevoId("SL"),
    laboratorio: { ...(r.id ? { rutinaId: r.id } : {}), enviada: o.ahora },
  };
}

function desdeLoGuardado(r: RutinaPuente, e: ExtraPizarra): Omit<SlidePizarra, "id"> {
  const vista = e.vista;

  let trazos: TrazoPizarra[] = e.trazos.map((t) => ({ ...t }));

  const guardadas = new Map(e.fichas.map((f) => [f.id, f]));

  const usadas = new Set<string>();

  const fichas: FichaPizarra[] = [];

  const desde = salidas(r.roles);

  r.roles.forEach((rol, i) => {
    const g = rol.ref ? guardadas.get(rol.ref) : undefined;

    const tipoCarrera: TipoTrazo = rol.papel === "bloqueador" ? "bloqueo" : "carrera";

    if (g && g.enLab && !usadas.has(g.id)) {
      usadas.add(g.id);

      const m = g.firma;

      let x = g.x;

      let y = g.y;

      if (rol.x !== undefined && rol.y !== undefined && (rol.x !== m.x || rol.y !== m.y)) {
        const nuevo = aLienzo(vista, { x: rol.x, y: rol.y });

        trazos = mueveArranque(trazos, g.cadena, { x, y }, nuevo);
        x = nuevo.x;
        y = nuevo.y;
      }

      const cambiaCarrera =
        (rol.hx ?? null) !== (m.hx ?? null) || (rol.hy ?? null) !== (m.hy ?? null) || (rol.hx !== undefined && (rol.fase ?? 2) !== (m.fase ?? 2));

      if (cambiaCarrera) {
        const primera = trazos.find((t) => t.id === g.cadena[0]);

        if (rol.hx === undefined || rol.hy === undefined) {
          trazos = trazos.filter((t) => !g.cadena.includes(t.id));
        } else {
          const fin = aLienzo(vista, { x: rol.hx, y: rol.hy });

          if (primera) {
            const viejo = { x: primera.x2, y: primera.y2 };

            const dx = fin.x - viejo.x;

            const dy = fin.y - viejo.y;

            trazos = trazos.map((t) =>
              t.id === primera.id
                ? {
                    ...t,
                    x2: fin.x,
                    y2: fin.y,
                    fase: faseDe(rol.fase),
                    ...(t.cx !== undefined && t.cy !== undefined ? { cx: Math.round(t.cx + dx / 2), cy: Math.round(t.cy + dy / 2) } : {}),
                  }
                : t,
            );
            /* La carrera siguiente de la cadena arrancaba en la punta vieja: va con ella. */
            trazos = mueveArranque(trazos, g.cadena.slice(1), viejo, fin);
          } else {
            trazos.push(nuevoTrazo(tipoCarrera, faseDe(rol.fase), { x, y }, fin));
          }
        }
      }

      fichas.push({ id: g.id, playerId: rol.jugador || g.playerId, puesto: g.puesto, x, y });

      return;
    }

    /* Un papel nuevo del laboratorio: ficha suelta donde lo pusieron. */
    const p = aLienzo(vista, rol.x !== undefined && rol.y !== undefined ? { x: rol.x, y: rol.y } : desde[i]);

    if (rol.jugador) {
      const id = rol.ref && !guardadas.has(rol.ref) && !fichas.some((f) => f.id === rol.ref) ? rol.ref : nuevoId("FI");

      fichas.push({ id, playerId: rol.jugador, puesto: null, x: p.x, y: p.y });
    }

    if (rol.hx !== undefined && rol.hy !== undefined) trazos.push(nuevoTrazo(tipoCarrera, faseDe(rol.fase), p, aLienzo(vista, { x: rol.hx, y: rol.hy })));
  });

  /* Las que no entraron en la rutina (más del tope) siguen; las que se quitaron aquí se van con sus carreras. */
  for (const g of e.fichas) {
    if (usadas.has(g.id)) continue;

    if (!g.enLab) fichas.push({ id: g.id, playerId: g.playerId, puesto: g.puesto, x: g.x, y: g.y });
    else trazos = trazos.filter((t) => !g.cadena.includes(t.id));
  }

  if (!igualBalon(r.balon, e.firma.balon)) {
    const viejos = trazos.filter((t) => t.tipo === "balon").sort((a, b) => a.fase - b.fase);

    trazos = [...trazos.filter((t) => t.tipo !== "balon"), ...(r.balon && r.balon.length >= 2 ? trazosDeBalon(r.balon, vista, viejos.map((t) => t.fase)) : [])];
  }

  /* Consignas y guion: lo guardado, salvo lo que se haya reescrito aquí. */
  let notas = [...e.notas];

  let guion: GuionConsigna | undefined = e.guion ? { ...e.guion } : undefined;

  if (r.idea !== e.firma.idea) {
    const c = consignasDeIdea(r.idea);

    notas = c.notas;

    const { rutina: _r, intencion: _i, ...resto } = guion ?? {};

    void _r;
    void _i;

    guion = { ...resto, ...(c.rutina ? { rutina: c.rutina } : {}), ...(c.intencion ? { intencion: c.intencion } : {}) };
  }

  if (r.senal !== e.firma.senal) {
    const { senal: _s, ...resto } = guion ?? {};

    void _s;

    guion = { ...resto, ...(r.senal.trim() ? { senal: r.senal.trim() } : {}) };
  }

  if (guion && !Object.keys(guion).length) guion = undefined;

  return {
    plantilla: e.plantilla,
    titulo: r.nombre === e.firma.nombre ? e.titulo : r.nombre.trim().toLocaleUpperCase("es"),
    vista,
    fichas,
    notas,
    ...(e.textos ? { textos: JSON.parse(JSON.stringify(e.textos)) } : {}),
    ...(trazos.length ? { trazos } : {}),
    ...(e.rivales.length ? { rivales: e.rivales.map((x) => ({ ...x })) } : {}),
    ...(guion ? { guion } : {}),
    ...(e.rev !== undefined ? { rev: e.rev } : {}),
  };
}

function desdeCero(r: RutinaPuente): Omit<SlidePizarra, "id"> {
  const vista: VistaCampo = r.tipo === "corner" ? "ancho" : "porteria";

  const desde = salidas(r.roles);

  const fichas: FichaPizarra[] = [];

  const trazos: TrazoPizarra[] = [];

  r.roles.forEach((rol, i) => {
    const p = aLienzo(vista, desde[i]);

    if (rol.jugador) fichas.push({ id: rol.ref && !fichas.some((f) => f.id === rol.ref) ? rol.ref : nuevoId("FI"), playerId: rol.jugador, puesto: null, x: p.x, y: p.y });

    if (rol.hx !== undefined && rol.hy !== undefined) trazos.push(nuevoTrazo(rol.papel === "bloqueador" ? "bloqueo" : "carrera", faseDe(rol.fase), p, aLienzo(vista, { x: rol.hx, y: rol.hy })));
  });

  trazos.push(...trazosDeBalon(recorridoBalon(r), vista, []));

  const c = consignasDeIdea(r.idea);

  const guion: GuionConsigna = {
    ...(r.senal.trim() ? { senal: r.senal.trim() } : {}),
    ...(c.rutina ? { rutina: c.rutina } : {}),
    ...(c.intencion ? { intencion: c.intencion } : {}),
  };

  const libre = PLANTILLA_BY_KEY.get("libre");

  return {
    plantilla: "libre",
    titulo: (r.nombre.trim() || "Rutina del laboratorio").toLocaleUpperCase("es"),
    vista,
    fichas,
    notas: c.notas,
    ...(trazos.length ? { trazos } : {}),
    ...(Object.keys(guion).length ? { guion } : {}),
    ...(libre ? { rev: libre.rev } : {}),
  };
}

/** Cuántos papeles no van a tener cara en la pizarra (no tienen jugador). */
export const sinJugador = (r: Pick<RutinaPuente, "roles">) => r.roles.filter((x) => !x.jugador).length;

/* ------------------------------------------------------------------ */
/*  ¿SIGUE EN LA PIZARRA?                                              */
/* ------------------------------------------------------------------ */

export type EstadoEnPizarra =
  | { estado: "igual"; slide: SlidePizarra }
  | { estado: "cambiada"; slide: SlidePizarra }
  | { estado: "enviada"; slide: SlidePizarra; enviada: string }
  | { estado: "fuera" }
  /** Una variante que todavía no ha ido a la pizarra (su madre sí está). */
  | { estado: "variante" }
  | { estado: "desconocido" };

/**
 * Cómo está en la pizarra la diapositiva de la que salió una rutina:
 * igual que cuando se trajo, cambiada allí, sustituida desde el laboratorio
 * por esta misma rutina, o ya no está.
 */
export function estadoEnPizarra(
  r: Pick<RutinaPuente, "id" | "origen" | "pizarra" | "padre">,
  tableros: Record<string, TableroPizarra> | null,
  normaliza: (t: TableroPizarra) => TableroPizarra = (t) => t,
): EstadoEnPizarra {
  if (!r.origen || !tableros) return { estado: "desconocido" };

  const todas = Object.values(tableros).flatMap((t) => normaliza(t).slides);

  /* Si se mandó a la pizarra (nueva o sustituyendo), la diapositiva lleva su sello. */
  const sellada = r.id ? todas.filter((s) => s.laboratorio?.rutinaId === r.id).sort((a, b) => b.laboratorio!.enviada.localeCompare(a.laboratorio!.enviada))[0] : undefined;

  if (sellada && sellada.laboratorio!.enviada > (r.origen.traidaEn ?? "")) return { estado: "enviada", slide: sellada, enviada: sellada.laboratorio!.enviada };

  if (r.padre) return { estado: "variante" };

  const tablero = tableros[r.origen.partidoId];

  const slide = tablero ? normaliza(tablero).slides.find((s) => s.id === r.origen!.slideId) : undefined;

  if (!slide) return { estado: "fuera" };

  return huellaSlide(slide) === r.pizarra?.huella ? { estado: "igual", slide } : { estado: "cambiada", slide };
}
