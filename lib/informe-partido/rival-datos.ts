/**
 * LOS DUELOS Y EL RIVAL DE UN VISTAZO, PARA EL INFORME DEL PARTIDO (06/10/2026).
 *
 * El informe del microciclo cuenta ahora lo mismo que dos pantallas:
 * - Competición → Duelos: nuestro once contra su once probable, duelo a duelo
 *   (con los cambios que se hayan hecho a mano allí);
 * - DATA → Un equipo de un vistazo: el rival resumido, colectivo e individual.
 *
 * Se calcula con el mismo código que esas pantallas (`lib/duelos-onces.ts` y
 * `lib/data-analisis/equipo.ts`), y aquí sólo se resume a lo que cabe en una
 * diapositiva y en un capítulo. Si Wyscout no contesta, el informe sale sin
 * estos dos bloques y lo avisa; nunca se queda esperando.
 */
/* Sólo tipos: leer.ts usa el sistema de archivos y no puede entrar en el navegador. */
import type { FilaJugador, FilaPartido } from "@/lib/data-analisis/leer";
import { formatea, temporadaDe } from "@/lib/data-analisis/metricas";

/** Decimales con coma y «55,0 %» (ronda 10, análisis: «Su estilo» salía con punto y el resto del informe con coma). */
const conComa = (t: string) => t.replace(/(\d)\.(\d)/g, "$1,$2").replace(/(\d)%/g, "$1 %");
import { PUESTOS } from "@/lib/data-analisis/individual";
import { perfilDe, plantillaDe, resumenDe, sintesisDe, type MetricaEquipo, type PerfilColectivo } from "@/lib/data-analisis/equipo";
import { alcanceWyscout, type PartidoCalendario } from "@/lib/data-analisis/alcance";
import { duelosDelPartido, type FichaPropia } from "@/lib/duelos-onces";
import { normalizaDuelos } from "@/lib/duelos";
import { puestoEnPalabras } from "@/lib/posiciones";
import { huecosDelUltimoOnce } from "@/lib/tactics/ultimoOnce";
import type { RatingsSeason } from "@/lib/ratings/types";
import type { Player } from "@/types/player";
import { mismoClub } from "@/lib/rivals/mismoClub";
/* El «hoy» del alcance de Wyscout, con el día de aquí y no el de UTC (19/10/2026). */
import { claveDeHoy } from "@/lib/rivals/orden-calendario";
import { slugClave } from "@/lib/rivals/media";
import type { InformeEquipo } from "@/lib/rivals/informe";
import type { DuelosInforme, EnfrentamientoInforme, VistazoRival } from "@/lib/informe-partido/modelo";

type Fila = Record<string, unknown>;

async function leeDoc<T>(key: string): Promise<T | null> {
  try {
    const r = await fetch(`/api/docs?key=${encodeURIComponent(key)}`, { cache: "no-store" });
    const j = (await r.json()) as { data?: T | null };
    return j?.data ?? null;
  } catch {
    return null;
  }
}

/** Los datos de Wyscout de toda la categoría (la misma petición que DATA). */
async function leeWyscout(): Promise<{ partidos: FilaPartido[]; jugadores: FilaJugador[] } | null> {
  try {
    const r = await fetch("/api/data-analisis");
    /* La ruta ya devuelve el índice expandido (cada jugador con su `datos`), como lo usa DATA. */
    const j = (await r.json()) as { ok?: boolean; partidos?: FilaPartido[]; jugadores?: FilaJugador[] };
    if (!j?.ok && !j?.partidos) return null;
    return { partidos: j.partidos ?? [], jugadores: j.jugadores ?? [] };
  } catch {
    return null;
  }
}

/**
 * Nuestro último once de Valoraciones, como en la pizarra y en Duelos
 * (23/10/2026). Sin red o sin partidos valorados, `null` y Duelos propone con
 * los minutos de Wyscout, como antes.
 */
async function baseNuestraDeValoraciones(fichas: FichaPropia[]): Promise<Record<string, string> | null> {
  try {
    const r = await fetch("/api/ratings/load", { cache: "no-store" });
    const j = (await r.json()) as { success?: boolean; season?: RatingsSeason };
    if (!j?.success || !j.season) return null;
    const reparto = huecosDelUltimoOnce(j.season, fichas as unknown as Player[]);
    if (!reparto.ultimo) return null;
    return Object.fromEntries(Object.entries(reparto.huecos).filter(([, id]) => id));
  } catch {
    return null;
  }
}

/** Métricas que no dicen si el rival es mejor o peor: volumen o disciplina. */
const SIN_SENTIDO_CLARO = new Set(["perdidas", "faltas", "amarillas", "rojas", "faltasPorAmarilla", "toquesPorEntrada"]);

/** Un porcentaje en 0 o 100, o un recuento en 0, es un artefacto de muestra. */
const esArtefacto = (x: MetricaEquipo) => (x.metrica.unidad === "porcentaje" && (x.valor >= 99.5 || x.valor <= 0.5)) || x.valor === 0;

/*
| Sólo lo que se separa de verdad de la mediana (ronda 10, análisis): 49,4 %
| frente a 52,1 % salía como «18.º» en «Sufre en». Fuera de la banda central
| (percentil 25-75) y con una distancia que se nota: 3 puntos en un
| porcentaje, un 10 % en lo demás.
*/
const seSepara = (x: MetricaEquipo) => {
  if (x.percentil !== null && x.percentil > 25 && x.percentil < 75) return false;

  const diferencia = Math.abs(x.valor - x.mediana);

  return x.metrica.unidad === "porcentaje" ? diferencia >= 3 : diferencia >= 0.1 * Math.max(Math.abs(x.mediana), 0.01);
};

const valeParaDestacar = (x: MetricaEquipo) => !SIN_SENTIDO_CLARO.has(x.metrica.key) && !esArtefacto(x) && seSepara(x);

function limpiaPerfil(perfil: PerfilColectivo | null): PerfilColectivo | null {
  if (!perfil) return null;

  return { ...perfil, fuertes: perfil.fuertes.filter(valeParaDestacar), flojos: perfil.flojos.filter(valeParaDestacar) };
}

export { puestoEnPalabras };

export async function duelosYVistazo(entrada: {
  rival: string;
  equipoHoja: string;
  filasHoja: Fila[];
  informeRival: InformeEquipo | null;
  marcados: string[];
  calendario: PartidoCalendario[];
  fichas: FichaPropia[];
}): Promise<{ duelos: DuelosInforme | null; vistazo: VistazoRival | null; avisos: string[] }> {
  const avisos: string[] = [];
  const [wy, manual] = await Promise.all([leeWyscout(), leeDoc<unknown>(`duelos:${slugClave(entrada.equipoHoja || "sin-equipo")}`)]);

  if (!wy || !wy.jugadores.length) {
    avisos.push("Wyscout no ha contestado: el informe sale sin los duelos ni el rival de un vistazo.");
    return { duelos: null, vistazo: null, avisos };
  }

  /* ---------------- los duelos ---------------- */
  let duelos: DuelosInforme | null = null;
  if (entrada.filasHoja.some((f) => String(f.NOMBRE_EQUIPO ?? "").trim() === entrada.equipoHoja)) {
    const { duelos: lista, fuenteSuya } = duelosDelPartido({
      jugadores: wy.jugadores,
      fichas: entrada.fichas,
      filasHoja: entrada.filasHoja,
      equipo: entrada.equipoHoja,
      marcados: entrada.marcados,
      informe: entrada.informeRival,
      aMano: normalizaDuelos(manual),
      baseNuestra: await baseNuestraDeValoraciones(entrada.fichas),
    });
    duelos = {
      fuenteSuya,
      lista: lista.map((d) => ({
        clave: d.def.clave,
        titulo: d.def.titulo,
        zona: d.def.zona,
        nuestros: d.nuestros.map((j) => j.nombre),
        suyos: d.suyos.map((j) => j.nombre),
        veredicto: d.veredicto,
        balance: d.balance,
        conBalon: d.conBalon,
        sinBalon: d.sinBalon,
        resumen: d.resumen,
        destacados: d.facetas
          .filter((f) => f.diferencia !== null && (f.veredicto === "ventaja" || f.veredicto === "desventaja"))
          .sort((a, b) => Math.abs(b.diferencia ?? 0) - Math.abs(a.diferencia ?? 0))
          .map(
            (f): EnfrentamientoInforme => ({
              sentido: f.sentido,
              titulo: f.titulo,
              nuestro: f.nuestro ?? 0,
              suyo: f.suyo ?? 0,
              veredicto: f.veredicto,
            }),
          ),
      })),
    };
    if (!duelos.lista.some((d) => d.veredicto !== "sin-datos")) avisos.push("Los duelos no tienen datos de Wyscout suficientes de uno de los dos onces.");
  } else {
    avisos.push(`No encuentro la plantilla de ${entrada.rival} en Plantillas rivales: el informe sale sin los duelos.`);
  }

  /* ---------------- el rival de un vistazo ---------------- */
  /* Los minutos mínimos para «los que más rinden», en la frase y en la lista (26/10/2026). */
  const MINIMO_FIGURAS = 450;
  /*
  | «Destaca / Sufre» sin artefactos (23/10/2026, experto de análisis): un
  | «Entradas logradas 100 % (1.º)» o «Tarjetas rojas 0 (1.º)» es muestra
  | pequeña, no una virtud; «Pérdidas» totales o «Faltas por amarilla» no
  | dicen si es bueno o malo. Fuera las métricas sin sentido claro y los
  | porcentajes en 0 o 100.
  */
  const ultima = wy.partidos.map((p) => p.fecha).sort().pop() ?? "";
  const deLaTemporada = wy.partidos.filter((p) => temporadaDe(p.fecha) === temporadaDe(ultima));
  const equipos = [...new Set(deLaTemporada.map((p) => p.equipo))];
  const equipo = equipos.find((e) => mismoClub(e, entrada.rival)) ?? equipos.find((e) => mismoClub(e, entrada.equipoHoja)) ?? "";

  let vistazo: VistazoRival | null = null;
  if (equipo) {
    const resumen = resumenDe(equipo, deLaTemporada, deLaTemporada);
    const perfil = limpiaPerfil(perfilDe(equipo, deLaTemporada));
    const plantilla = plantillaDe(equipo, wy.jugadores);
    const alcance = alcanceWyscout(wy.partidos, entrada.calendario, claveDeHoy());
    const met = (x: { metrica: { nombre: string; unidad: Parameters<typeof formatea>[1] }; valor: number; puesto: number; de: number; mediana: number }) => ({
      nombre: x.metrica.nombre,
      valor: conComa(formatea(x.valor, x.metrica.unidad)),
      /* Valor y mediana, no un puesto suelto (ronda 10, análisis). */
      mediana: conComa(formatea(x.mediana, x.metrica.unidad)),
      puesto: x.puesto,
      de: x.de,
    });
    vistazo = {
      equipo,
      competicion: perfil?.competicion ?? "",
      alcance: alcance.jornada
        ? /* Que la jornada esté a medias va en los avisos, no en el informe (19/10/2026). */
          `Wyscout hasta la J${alcance.jornada}${alcance.estado === "completa" ? " · jornada completa" : ""}`
        : "",
      partidos: resumen.partidos,
      g: resumen.g,
      e: resumen.e,
      p: resumen.p,
      gf: resumen.gf,
      gc: resumen.gc,
      tabla: resumen.tabla,
      forma: resumen.forma.map((f) => ({ resultado: f.resultado, rival: f.rival, marcador: f.marcador, casa: f.casa })),
      sistemas: resumen.sistemas.slice(0, 3),
      fases: (perfil?.fases ?? []).map((f) => ({ label: f.label, percentil: f.percentil })),
      fuertes: (perfil?.fuertes ?? []).slice(0, 4).map(met),
      flojos: (perfil?.flojos ?? []).slice(0, 4).map(met),
      estilo: (perfil?.estilo ?? []).slice(0, 6).map((x) => ({
        nombre: x.metrica.nombre,
        valor: conComa(formatea(x.valor, x.metrica.unidad)),
        mediana: conComa(formatea(x.mediana, x.metrica.unidad)),
        puesto: x.puestoDeMas,
        de: x.de,
      })),
      frases: sintesisDe(equipo, resumen, perfil, plantilla, MINIMO_FIGURAS),
      /*
      | Con 450′ como mínimo (25/10/2026, experto de análisis: «duelos aéreos P100»
      | sobre 369′ era muestra de cuatro partidos) y en palabras de caseta: el
      | puesto en español («central izquierdo», no «CEN LCB») y el percentil
      | dicho («mejor que 99 de cada 100 de su puesto»), no una «P» suelta.
      */
      figuras: plantilla
        .filter((j) => j.indice !== null && j.fila.minutos >= MINIMO_FIGURAS)
        .sort((a, b) => (b.indice ?? 0) - (a.indice ?? 0))
        .slice(0, 4)
        .map((j) => ({
          nombre: j.fila.jugador,
          posicion: puestoEnPalabras(j.fila.posicion.split(",")[0] ?? "") || (PUESTOS.find((p) => p.key === j.puesto)?.label ?? "").toLowerCase(),
          indice: j.indice ?? 0,
          minutos: j.fila.minutos,
          destaca: j.destaca.slice(0, 2).map((p) => `${p.metrica.nombre}: ${p.percentil >= 100 ? "el mejor de su puesto" : `mejor que ${p.percentil} de cada 100 de su puesto`}`),
        })),
      /* Con 270′ o más: el lado de Wyscout manda sobre el de la ficha (26/10/2026). */
      puestos: plantilla
        .filter((j) => j.fila.minutos >= 270)
        .map((j) => ({ nombre: j.fila.jugador, posicion: puestoEnPalabras(j.fila.posicion.split(",")[0] ?? ""), minutos: j.fila.minutos }))
        .filter((p) => p.posicion),
    };
    if (alcance.estado === "incompleta") avisos.push(`Wyscout: ${alcance.detalle}`);
  } else {
    avisos.push(`Wyscout no tiene partidos de ${entrada.rival} esta temporada: el informe sale sin el rival de un vistazo.`);
  }

  return { duelos, vistazo, avisos };
}
