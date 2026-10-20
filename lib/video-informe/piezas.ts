/*
|--------------------------------------------------------------------------
| EL CATÁLOGO DE LA SEMANA (22/10/2026, crítica del productor de vídeo)
|--------------------------------------------------------------------------
|
| Una pieza por público y por día, todas del mismo guion que el PDF:
|   Lun · el partido, cuerpo técnico (horizontal, correo y PDF)
|   Mar · lo que nos deja, jugadores (vertical, WhatsApp)
|   Jue · la previa, cuerpo técnico (horizontal, correo y charla)
|   Vie · consignas, jugadores (vertical, WhatsApp)
|   Vie · balón parado, jugadores (el vídeo del analista, WhatsApp)
| Y una regla: cada consigna sale en UNA sola pieza por día. El viernes van
| dos piezas a los jugadores; la consigna de balón parado va sólo en la de
| balón parado, no también en la de consignas.
*/

import type { InformePartido } from "@/lib/informe-partido/modelo";

import { guionDePartido, type CortePartido, type Escena, type ExtrasPartido, type GuionVideo } from "./guion";

export type DiaDePieza = {
  dia: "Lunes" | "Martes" | "Jueves" | "Viernes";
  /** El id de la pieza en «Vídeos de la semana». */
  pieza: "cuerpo-tecnico" | "jugadores" | "abp";
  momento: "previa" | "post" | null;
  nombre: string;
  publico: string;
  canal: string;
};

export const CALENDARIO_SEMANAL: DiaDePieza[] = [
  { dia: "Lunes", pieza: "cuerpo-tecnico", momento: "post", nombre: "El partido", publico: "Cuerpo técnico", canal: "Correo (enlace en HD) y PDF" },
  { dia: "Martes", pieza: "jugadores", momento: "post", nombre: "Lo que nos deja", publico: "Jugadores", canal: "WhatsApp, vertical" },
  { dia: "Jueves", pieza: "cuerpo-tecnico", momento: "previa", nombre: "La previa", publico: "Cuerpo técnico", canal: "Correo y charla" },
  { dia: "Viernes", pieza: "jugadores", momento: "previa", nombre: "Consignas", publico: "Jugadores", canal: "WhatsApp, vertical" },
  { dia: "Viernes", pieza: "abp", momento: null, nombre: "Balón parado", publico: "Jugadores", canal: "WhatsApp (vídeo del analista)" },
];

/** El día de cada pieza para este informe (las de ABP valen para la previa). */
export function diaDePieza(pieza: DiaDePieza["pieza"], momento: "previa" | "post") {
  return CALENDARIO_SEMANAL.find((d) => d.pieza === pieza && (d.momento === null || d.momento === momento)) ?? null;
}

/** Lo que es balón parado en una consigna. */
const ES_ABP = /c[oó]rner|falta (lateral|frontal|directa)|bal[oó]n parado|saque de (banda|esquina)|segundo palo|primer palo|\bABP\b|penalti/i;

/**
 * La regla de «una consigna, una pieza por día»: si ese día los jugadores
 * reciben también la pieza de balón parado, las consignas de balón parado
 * salen de la de consignas. Si todas eran de balón parado, la pieza queda
 * como estaba (mejor repetida que vacía). El cierre que fuera de balón
 * parado pasa a la primera consigna que no lo sea.
 */
export function sinConsignasDeAbp(guion: GuionVideo): GuionVideo {
  const claves = guion.escenas.find((e): e is Extract<Escena, { tipo: "claves" }> => e.tipo === "claves");
  const quedan = claves ? claves.lineas.map((l, i) => ({ l, pie: claves.pies?.[i] })).filter((x) => !ES_ABP.test(x.l)) : [];

  if (!claves || !quedan.length) return guion;

  return {
    ...guion,
    escenas: guion.escenas.map((e) => {
      if (e === claves) return { ...claves, lineas: quedan.map((x) => x.l), pies: claves.pies ? quedan.map((x) => x.pie ?? "") : undefined };

      if (e.tipo === "cierre" && e.lineas.some((l) => ES_ABP.test(l))) return { ...e, lineas: [quedan[0].l], pie: quedan[0].pie || undefined };

      return e;
    }),
  };
}

/**
 * LA PIEZA DE POST PARA LOS JUGADORES (vertical): el gancho, la portada, los
 * goles con su corte (los nuestros y el que nos marcaron, con la
 * repetición), lo que nos hicieron (como mucho dos cortes) y la consigna de
 * la semana. Sin balance, sin cifras y sin pronóstico. Sin cortes no hay
 * pieza: unas letras sobre el escudo no merecen un vídeo (devuelve null).
 */
export function consignasDePost(informe: InformePartido, extras: ExtrasPartido = {}): GuionVideo | null {
  if (informe.momento !== "post") return null;

  const completo = guionDePartido(informe, extras);
  const escena = (id: string) => completo.escenas.find((e) => e.id === id);
  const deCortes = (id: string) => {
    const e = escena(id);

    return e && e.tipo === "clips" && e.cortes.length ? e : null;
  };

  const goles = deCortes("clips-1");
  const suyos = deCortes("clips-3");

  /* Lo que nos hicieron: dos cortes como mucho (sin repetición), que lo que importa es la consigna. */
  const recorte = suyos
    ? (() => {
        const cortes = suyos.cortes.filter((c) => !c.repeticion).slice(0, 2);

        return { ...suyos, cortes, segundos: cortes.reduce((s, c) => s + ((c as Partial<CortePartido>).segundos ?? 0), 0) || suyos.segundos };
      })()
    : null;

  if (!goles && !recorte) return null;

  const piezas = [escena("gancho"), escena("portada"), goles, recorte, escena("cierre")].filter((e): e is Escena => Boolean(e));

  return { titulo: `${informe.partido.rival} · lo que nos deja`, escenas: piezas };
}
