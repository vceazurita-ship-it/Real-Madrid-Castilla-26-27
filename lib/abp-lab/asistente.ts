/**
 * EL ASISTENTE DEL TALLER (laboratorio de ABP, 24/10/2026).
 *
 * Contra el próximo rival, prueba cada rutina a favor de córner o falta tal
 * cual y con los retoques que un entrenador haría en la pizarra —desde el
 * otro lado, otro envío, al primer o al segundo palo—, mide cada una con la
 * misma simulación de la pizarra (`evaluaRemate` contra su defensa: la de su
 * scouting y sus jugadores más altos) y propone la mejor, con su porqué en
 * una frase.
 *
 * La frase sólo cuenta lo que se sabe: si el scouting no dice cómo defiende,
 * no se nombra su sistema; si falta una altura, no hay duelo que contar.
 */

import { VUELO, recorridoBalon, reflejada } from "@/lib/abp-lab/campo";
import { PAPELES, etiqueta, type Envio, type Rol, type Rutina } from "@/lib/abp-lab/modelo";
import { defensaEn, estadoBalon } from "@/lib/abp-lab/simulacion";
import { evaluaRemate, planCon, type DefensaRival, type Remate } from "@/lib/abp-lab/ventaja";
import { comaXg, type CalibreXg } from "@/lib/abp-lab/xg";

export type Retoque = {
  key: string;
  /** «Tal cual», «Al segundo palo»… */
  nombre: string;
  /** La rutina con el retoque puesto (la misma si es «tal cual»). */
  rutina: Rutina;
};

const ENVIO_FRASE: Record<Envio, string> = { tenso: "Con el envío tenso", bombeado: "Bombeado", raso: "Raso" };

/** Los retoques que se prueban: pocos y de pizarra, nada que cambie quién hace qué. */
export function retoquesDe(r: Rutina): Retoque[] {
  const lista: Retoque[] = [{ key: "tal", nombre: "Tal cual", rutina: r }];

  const camino = recorridoBalon(r);

  const golpeo = camino[0];

  const caida = camino.at(-1)!;

  if (r.tipo === "corner") lista.push({ key: "lado", nombre: "Desde el otro córner", rutina: reflejada(r) });

  const envio = r.envio ?? "tenso";

  for (const otro of ["tenso", "bombeado"] as const) {
    if (otro !== envio) lista.push({ key: `envio-${otro}`, nombre: ENVIO_FRASE[otro], rutina: { ...r, envio: otro } });
  }

  /* El primer palo es el del lado del saque. */
  const desdeIzquierda = golpeo.x < 34;

  const palos = [
    { key: "primer", nombre: "Al primer palo", p: { x: desdeIzquierda ? 29.5 : 38.5, y: 4.5 } },
    { key: "segundo", nombre: "Al segundo palo", p: { x: desdeIzquierda ? 39.5 : 28.5, y: 5.5 } },
  ];

  for (const palo of palos) {
    if (Math.hypot(caida.x - palo.p.x, caida.y - palo.p.y) < 3) continue;

    lista.push({ key: palo.key, nombre: palo.nombre, rutina: { ...r, balon: [...camino.slice(0, -1), palo.p] } });
  }

  return lista;
}

export type Propuesta = {
  original: Rutina;
  retoque: Retoque;
  remate: Remate;
  /** El xG de la rutina tal cual contra ellos (si se puede medir). */
  base: number | null;
  /** Cuántos de los suyos quedan bloqueados en el remate. */
  bloqueados: number;
  porque: string;
};

type Estructura = { tipo: "zonal" | "hombre" | "mixta"; enZona?: number | null } | null;

const nombreCorto = (n: string) => {
  const partes = n.trim().split(/\s+/);

  return partes.length > 1 && partes[0].length <= 3 ? partes.slice(0, 2).join(" ") : (partes[0] ?? n);
};

const ZONA_FRASE: Record<Remate["zona"], string> = {
  "primer-palo": "en el primer palo",
  centro: "en el centro del área",
  "segundo-palo": "en el segundo palo",
  frontal: "en la frontal",
};

/** Cómo se dice su sistema en la charla: «su zona de cinco», «su marca al hombre». */
function suDefensa(e: Estructura) {
  if (!e) return "";

  const numeros = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho"];

  const n = e.enZona && e.enZona < numeros.length ? numeros[e.enZona] : e.enZona ? String(e.enZona) : "";

  return e.tipo === "zonal" ? `su zona${n ? ` de ${n}` : ""}` : e.tipo === "hombre" ? "su marca al hombre" : `su mixta${n ? ` con ${n} en zona` : ""}`;
}

/** La frase de entrenador: qué cambiamos, contra qué, quién remata y cómo. */
export function fraseDe(p: Omit<Propuesta, "porque">, estructura: Estructura, nombreDe: (rol: Rol) => string | null): string {
  const { retoque, remate } = p;

  const rol = remate.quien !== null ? retoque.rutina.roles[remate.quien] : undefined;

  const quien = rol ? (nombreDe(rol) ?? `el ${etiqueta(PAPELES, rol.papel).toLowerCase()}`) : "";

  const contra = suDefensa(estructura);

  const accion =
    remate.presion === "libre"
      ? `${quien} remata solo`
      : remate.presion === "normal"
        ? `${quien} llega con la marca a ${remate.marca !== null ? `${remate.marca.toFixed(1).replace(".", ",")} m` : "distancia"}`
        : remate.presion === "tapado"
          ? `${quien} remata con un defensor cerca`
          : `${quien} remata con el defensor pegado`;

  const duelo = remate.difCm !== null && Math.abs(remate.difCm) >= 3 ? (remate.difCm > 0 ? ` y le saca ${remate.difCm} cm a su par` : `, aunque le sacan ${-remate.difCm} cm`) : "";

  const cuantos = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis"][p.bloqueados] ?? String(p.bloqueados);

  const bloqueo = p.bloqueados > 0 ? `, con ${p.bloqueados === 1 ? "uno de los suyos bloqueado" : `${cuantos} de los suyos bloqueados`}` : "";

  const cuerpo = `${contra ? `contra ${contra}, ` : ""}${accion} ${ZONA_FRASE[remate.zona]}${duelo}${bloqueo}.`;

  const cifra = p.base !== null && retoque.key !== "tal" && p.base > 0 ? ` xG ${comaXg(p.base)} → ${comaXg(remate.xg)}.` : ` xG ${comaXg(remate.xg)}.`;

  const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return retoque.key === "tal" ? `${mayuscula(cuerpo)}${cifra}` : `${retoque.nombre}: ${cuerpo}${cifra}`;
}

/**
 * Las mejores propuestas contra el próximo rival, de mejor a peor (una por
 * rutina: su mejor retoque). Vacío si no hay rival con que medir.
 */
export function proponer(
  rutinas: Rutina[],
  defensaDe: (r: Rutina) => DefensaRival | null,
  calibre: CalibreXg | null,
  alturaDe: (rol: Rol) => number | null,
  estructura: (r: Rutina) => Estructura,
  nombreDe: (rol: Rol) => string | null,
): Propuesta[] {
  const propuestas: Propuesta[] = [];

  for (const r of rutinas) {
    if (r.lado !== "ofensivo" || !r.roles.length || (r.tipo !== "corner" && r.tipo !== "falta")) continue;

    let base: number | null = null;

    let mejor: Omit<Propuesta, "porque"> | null = null;

    for (const retoque of retoquesDe(r)) {
      const def = defensaDe(retoque.rutina);

      if (!def) continue;

      const plan = planCon(retoque.rutina, def);

      const remate = evaluaRemate(retoque.rutina, plan, calibre, alturaDe);

      if (!remate || remate.quien === null || remate.directo || remate.xg <= 0) continue;

      if (retoque.key === "tal") base = remate.xg;

      /* Un retoque tiene que mejorar algo de verdad para quitarle el sitio a la rutina tal cual. */
      const umbral = mejor ? mejor.remate.xg + (mejor.retoque.key === "tal" ? 0.01 : 0) : 0;

      if (mejor && remate.xg <= umbral) continue;

      const camino = recorridoBalon(retoque.rutina);

      const estado = defensaEn(plan, retoque.rutina.roles, VUELO[1], camino.at(-1)!, (s) => estadoBalon(camino, s, retoque.rutina.envio ?? "tenso", retoque.rutina.tipo).suelo);

      mejor = { original: r, retoque, remate, base, bloqueados: estado.bloqueado.filter(Boolean).length };
    }

    if (mejor) propuestas.push({ ...mejor, base, porque: fraseDe({ ...mejor, base }, estructura(r), nombreDe) });
  }

  return propuestas.sort((a, b) => b.remate.xg - a.remate.xg);
}

/** El nombre corto de un jugador, para la frase. */
export const nombreParaFrase = (nombre?: string) => (nombre ? nombreCorto(nombre) : null);
