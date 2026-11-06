/**
 * Las siglas de una diapositiva y lo que significa cada una (01/11/2026).
 *
 * En la sala las chapas dicen «R1», «BZ», «RL»… y quien no estuvo en la
 * charla no sabe qué es cada cosa: la leyenda va bajo el panel de
 * asignaciones. Sale de los propios puestos de la diapositiva —la sigla que se
 * pinta (`siglaDe`) y su `label`—, así que si el analista reescribe una sigla,
 * la leyenda la sigue.
 *
 * Dos puestos pueden llevar la misma sigla a posta: en la barrera hay dos «C»
 * (central I y central D). Eso no es un choque —significan lo mismo, cambia el
 * lado—, así que el significado se compara sin el lado ni el número del final.
 * Sí lo es que una «E» sea a la vez «Zaguero 1» y «Corta»: el editor lo avisa.
 */

import { siglaDe, type PuestoAbp } from "@/lib/abp/pizarra";

export type SiglaLeyenda = {
  sigla: string;
  /** Lo que se lee en la leyenda. */
  significado: string;
  /** Los significados distintos que tiene en la diapositiva (más de uno = choque). */
  significados: string[];
};

/** Quita el lado o el número del final: «Barrera · central I» → «Barrera · central». */
function sinLado(label: string) {
  return label
    .trim()
    .replace(/\s+(?:\d+|[ID]|izq(?:uierd[oa])?|der(?:ech[oa])?)\.?$/i, "")
    .trim();
}

function clave(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

/**
 * La leyenda: una entrada por sigla, en el orden en que salen los puestos.
 * Las siglas que ya se leen enteras («CORTA» = «Corta») no se explican.
 */
export function leyendaSiglas(puestos: Pick<PuestoAbp, "code" | "sigla" | "label">[]): SiglaLeyenda[] {
  const porSigla = new Map<string, { sigla: string; labels: string[] }>();

  for (const puesto of puestos) {
    const sigla = siglaDe(puesto).trim();

    if (!sigla || !puesto.label?.trim()) continue;

    const llave = sigla.toUpperCase();
    const una = porSigla.get(llave) ?? { sigla, labels: [] };

    if (!una.labels.includes(puesto.label.trim())) una.labels.push(puesto.label.trim());
    porSigla.set(llave, una);
  }

  const salida: SiglaLeyenda[] = [];

  for (const { sigla, labels } of porSigla.values()) {
    /* Los significados distintos, sin contar el lado ni el número. */
    const bases = new Map<string, string>();

    for (const label of labels) {
      const base = sinLado(label) || label;

      if (!bases.has(clave(base))) bases.set(clave(base), labels.length > 1 ? base : label);
    }

    const significados = [...bases.values()];
    const significado = significados.join(" / ");

    if (significados.length === 1 && clave(significado) === clave(sigla)) continue;

    salida.push({ sigla, significado, significados });
  }

  return salida;
}

/** Las siglas que en la misma diapositiva quieren decir dos cosas distintas. */
/**
 * Siglas nuevas para deshacer los choques (06/11/2026): a cada puesto de una
 * sigla repetida con otro significado, las dos primeras letras de su
 * significado («Equilibrio» → «EQ», «Zaguero 1» → «ZA»); si aún chocan, se
 * numera. Devuelve { key del puesto: sigla nueva } sólo para los que cambian.
 */
export function siglasSinChoque(puestos: Pick<PuestoAbp, "key" | "code" | "sigla" | "label">[]): Record<string, string> {
  const choques = new Set(siglasQueChocan(puestos).map((c) => c.sigla));
  if (!choques.size) return {};
  const usadas = new Set(puestos.filter((p) => !choques.has(p.sigla ?? p.code)).map((p) => p.sigla ?? p.code));
  const nuevas: Record<string, string> = {};
  const porSignificado = new Map<string, string>();
  for (const p of puestos) {
    const actual = p.sigla ?? p.code;
    if (!choques.has(actual)) continue;
    const sig = clave(sinLado(p.label));
    let s = porSignificado.get(sig);
    if (!s) {
      const letras = sig.replace(/[^a-zñ]/g, "").toUpperCase();
      s = letras.slice(0, 2) || actual;
      for (let n = 2; usadas.has(s); n++) s = `${letras.slice(0, 1) || actual}${n}`;
      usadas.add(s);
      porSignificado.set(sig, s);
    }
    if (s !== actual) nuevas[p.key] = s;
  }
  return nuevas;
}

export function siglasQueChocan(puestos: Pick<PuestoAbp, "code" | "sigla" | "label">[]) {
  return leyendaSiglas(puestos).filter((una) => una.significados.length > 1);
}
