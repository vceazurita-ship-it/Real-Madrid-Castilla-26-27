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
import { PUESTOS } from "@/lib/data-analisis/individual";
import { perfilDe, plantillaDe, resumenDe, sintesisDe } from "@/lib/data-analisis/equipo";
import { alcanceWyscout, type PartidoCalendario } from "@/lib/data-analisis/alcance";
import { duelosDelPartido, type FichaPropia } from "@/lib/duelos-onces";
import { normalizaDuelos } from "@/lib/duelos";
import { mismoClub } from "@/lib/rivals/mismoClub";
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
  const ultima = wy.partidos.map((p) => p.fecha).sort().pop() ?? "";
  const deLaTemporada = wy.partidos.filter((p) => temporadaDe(p.fecha) === temporadaDe(ultima));
  const equipos = [...new Set(deLaTemporada.map((p) => p.equipo))];
  const equipo = equipos.find((e) => mismoClub(e, entrada.rival)) ?? equipos.find((e) => mismoClub(e, entrada.equipoHoja)) ?? "";

  let vistazo: VistazoRival | null = null;
  if (equipo) {
    const resumen = resumenDe(equipo, deLaTemporada, deLaTemporada);
    const perfil = perfilDe(equipo, deLaTemporada);
    const plantilla = plantillaDe(equipo, wy.jugadores);
    const alcance = alcanceWyscout(wy.partidos, entrada.calendario, new Date().toISOString().slice(0, 10));
    const met = (x: { metrica: { nombre: string; unidad: Parameters<typeof formatea>[1] }; valor: number; puesto: number; de: number }) => ({
      nombre: x.metrica.nombre,
      valor: formatea(x.valor, x.metrica.unidad),
      puesto: x.puesto,
      de: x.de,
    });
    vistazo = {
      equipo,
      competicion: perfil?.competicion ?? "",
      alcance: alcance.jornada
        ? `Wyscout hasta la J${alcance.jornada}${alcance.estado === "completa" ? " · jornada completa" : " · jornada incompleta"}`
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
        valor: formatea(x.valor, x.metrica.unidad),
        mediana: formatea(x.mediana, x.metrica.unidad),
        puesto: x.puestoDeMas,
        de: x.de,
      })),
      frases: sintesisDe(equipo, resumen, perfil, plantilla),
      figuras: plantilla
        .filter((j) => j.indice !== null && j.fila.minutos >= 270)
        .sort((a, b) => (b.indice ?? 0) - (a.indice ?? 0))
        .slice(0, 4)
        .map((j) => ({
          nombre: j.fila.jugador,
          posicion: `${PUESTOS.find((p) => p.key === j.puesto)?.corto ?? ""} ${j.fila.posicion.split(",")[0]}`.trim(),
          indice: j.indice ?? 0,
          minutos: j.fila.minutos,
          destaca: j.destaca.slice(0, 2).map((p) => `${p.metrica.nombre} P${p.percentil}`),
        })),
    };
    if (alcance.estado === "incompleta") avisos.push(`Wyscout: ${alcance.detalle}`);
  } else {
    avisos.push(`Wyscout no tiene partidos de ${entrada.rival} esta temporada: el informe sale sin el rival de un vistazo.`);
  }

  return { duelos, vistazo, avisos };
}
