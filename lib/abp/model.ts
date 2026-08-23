/**
 * Vocabulario común de acciones a balón parado.
 *
 * Las cuatro hojas de ABP (córners y faltas, ofensivas y defensivas, más los
 * dos saques de banda) escriben el tipo de acción en texto libre: "Córner",
 * "Falta lateral interior Z4", "Falta directa perfilada Z3", "Penati"… Aquí se
 * reduce todo a una familia cerrada, que es lo que el cuerpo técnico compara.
 *
 * Es también el contrato que espera la hoja de scouting de ABP rival: si esa
 * hoja escribe "Saque de meta" o "Saque de medio", esta función ya las
 * reconoce aunque hoy ninguna hoja las registre.
 */

export type AbpFamily =
  | "corner"
  | "falta-lateral"
  | "falta-directa"
  | "penalti"
  | "banda"
  | "saque-medio"
  | "saque-meta"
  | "otra";

export const ABP_FAMILIES: { key: AbpFamily; label: string; short: string }[] = [
  { key: "corner", label: "Córner", short: "Córner" },
  { key: "falta-lateral", label: "Falta lateral", short: "F. lateral" },
  { key: "falta-directa", label: "Falta directa", short: "F. directa" },
  { key: "penalti", label: "Penalti", short: "Penalti" },
  { key: "banda", label: "Saque de banda", short: "Banda" },
  { key: "saque-medio", label: "Saque de medio", short: "S. medio" },
  { key: "saque-meta", label: "Saque de meta", short: "S. meta" },
  { key: "otra", label: "Otra", short: "Otra" },
];

export const FAMILY_LABEL: Record<AbpFamily, string> = Object.fromEntries(
  ABP_FAMILIES.map((family) => [family.key, family.label]),
) as Record<AbpFamily, string>;

/** Quita acentos y baja a minúsculas: la hoja mezcla mayúsculas y tildes. */
export function norm(value?: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Familia de la acción a partir del texto de `Tipo_Accion`.
 *
 * "Penati" es una errata recurrente en la hoja y se reconoce a propósito: es
 * más barato aceptarla aquí que perseguirla en cada registro.
 */
export function abpFamily(tipoAccion?: string): AbpFamily {
  const t = norm(tipoAccion);

  if (!t) return "otra";

  if (t.includes("corner") || t.includes("esquina")) return "corner";
  if (t.includes("penalti") || t.includes("penati") || t.includes("penal")) {
    return "penalti";
  }
  if (t.includes("falta")) {
    return t.includes("directa") ? "falta-directa" : "falta-lateral";
  }
  if (t.includes("banda") || t.includes("saque de banda")) return "banda";
  if (t.includes("medio") || t.includes("centro del campo")) return "saque-medio";
  if (t.includes("meta") || t.includes("puerta")) return "saque-meta";

  return "otra";
}

/**
 * Zona del campo que acompaña al tipo de falta ("Falta lateral interior Z4").
 * Devuelve el número de zona, o null si la acción no la lleva.
 */
export function abpZone(tipoAccion?: string): number | null {
  const match = norm(tipoAccion).match(/z\s*([1-6])/);

  return match ? Number(match[1]) : null;
}

/** Perfil de la falta: interior, exterior o centrada. */
export function abpProfile(tipoAccion?: string): string | null {
  const t = norm(tipoAccion);

  if (t.includes("interior")) return "Interior";
  if (t.includes("exterior")) return "Exterior";
  if (t.includes("centrada")) return "Centrada";
  if (t.includes("perfilada")) return "Perfilada";

  return null;
}

/* ------------------------------------------------------------------ */
/*  RESULTADO                                                          */
/* ------------------------------------------------------------------ */

export type AbpOwner = "rmcf" | "rival" | "neutro";

export type AbpResult = {
  /** Etiqueta canónica; las variantes de la hoja se unifican aquí. */
  label: string;
  owner: AbpOwner;
  /** 0 nada · 1 posicional · 2 ABP · 3 conquista · 4 ocasión · 5 gol. */
  rank: number;
};

/**
 * Normaliza `Resultado_Final`.
 *
 * Ojo: las hojas NO comparten convención, y de eso depende que el peligro se
 * asigne al equipo correcto.
 *
 * - Las de saque de banda y la de córners a favor son absolutas: sin sufijo es
 *   del RMCF y acabado en «Rival» es del rival.
 * - La de córners en contra tiene como sujeto implícito al que ataca, que es
 *   el rival: allí «Ocasión» es una ocasión SUYA, y lo nuestro se marca a mano
 *   («Gol RMCF», «Transición Ofensiva»).
 *
 * Por eso quien llama declara `implicitOwner`: de quién es el resultado cuando
 * la celda no lo dice. Sin esto, todo el ataque del rival contaba como nuestro
 * y el peligro salía a cero.
 */
export function abpResult(
  value?: string,
  implicitOwner: AbpOwner = "rmcf",
): AbpResult {
  const t = norm(value);

  if (!t) return { label: "Sin dato", owner: "neutro", rank: 0 };

  const explicitRival = /\brival\b/.test(t);
  const explicitOurs = /\brmcf\b|\bofensiva\b/.test(t);

  const owner: AbpOwner = explicitRival
    ? "rival"
    : explicitOurs
      ? "rmcf"
      : implicitOwner;

  const suffix = owner === "rival" ? " Rival" : "";

  if (t.includes("gol")) return { label: `Gol${suffix}`, owner, rank: 5 };
  if (t.includes("ocas")) return { label: `Ocasión${suffix}`, owner, rank: 4 };
  if (t.includes("conquista") || t.includes("ultimo tercio")) {
    return { label: `Conquista último tercio${suffix}`, owner, rank: 3 };
  }
  if (t.includes("abp")) return { label: `ABP${suffix}`, owner, rank: 2 };
  if (t.includes("transici")) {
    return { label: `Transición${suffix}`, owner, rank: 1 };
  }
  if (t.includes("posicional")) return { label: `Posicional${suffix}`, owner, rank: 1 };
  if (t.includes("nada")) return { label: "Nada", owner: "neutro", rank: 0 };

  return { label: (value || "").trim() || "Sin dato", owner: "neutro", rank: 0 };
}

/** Gol u ocasión clara: el umbral con el que se juzga si un ABP hizo daño. */
export function esPeligro(result: AbpResult, owner: AbpOwner) {
  return result.owner === owner && result.rank >= 4;
}

/** Número tolerante con la coma decimal y con el texto suelto de la hoja. */
export function num(value?: string | number): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  return (
    Number(
      String(value ?? "")
        .replace(",", ".")
        .replace(/[^\d.-]/g, ""),
    ) || 0
  );
}

/** Altura en centímetros a partir de "190cm", "1,90", "190"… */
export function alturaCm(value?: string | number): number | null {
  const raw = String(value ?? "").trim();

  if (!raw) return null;

  const parsed = Number(raw.replace(",", ".").replace(/[^\d.]/g, ""));

  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  /* La hoja mezcla "190cm" y "1,90": por debajo de 3 se asume metros. */
  return parsed < 3 ? Math.round(parsed * 100) : Math.round(parsed);
}

/** Compara nombres de equipo entre hojas distintas (tildes, mayúsculas, CF/CD…). */
export function teamKey(value?: string) {
  return norm(value)
    .replace(
      /\b(cf|cd|sd|ud|ad|ca|rc|rcd|club|de|del|la|el|balompie|futbol|deportivo)\b/g,
      "",
    )
    .replace(/[^a-z0-9]/g, "");
}
