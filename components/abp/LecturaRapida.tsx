/*
| Las cuatro tarjetas de arriba de cada pantalla de balón parado (02/11/2026):
| qué funciona, qué falla, qué entrenar y sobre qué base. Las cuentas están en
| `lib/abp/lectura-rapida.ts`; aquí sólo se pintan. Lo que no sale de los
| datos no se pinta: sin hallazgo, no hay tarjeta (ni hueco, ni guion).
|
| Los colores van por las variables de la escala (`--rmcf-rate-*`), que ya
| tienen su versión de día: nada de verdes claros sobre panel blanco.
|
| 07/11/2026 (jueces, ronda 14): con menos de 15 acciones EN EL GRUPO —no en
| el total— no hay fortaleza ni carencia: la tarjeta sale en gris y se titula
| «Indicio». Con menos de 5 no sale. Y «Qué entrenar» ya no promete «6
| saques más si rindiera como el resto»: lleva la tarea, qué se cuenta en
| ella y el objetivo de partido sacado de un dato con su fuente.
*/

import Link from "next/link";

import type { HallazgoLectura, LecturaRapida as Lectura } from "@/lib/abp/lectura-rapida";

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Por debajo de esto un grupo es indicio, no fortaleza ni carencia. */
export const MUESTRA_FIRME = 15;
/** Por debajo de esto un grupo no se enseña: 1 de 3 no es un hallazgo. */
const MUESTRA_VISIBLE = 5;

function capital(texto: string) {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto;
}

function Tarjeta({
  rotulo,
  color,
  titular,
  cifra,
  pie,
  enlace,
  pequena = false,
}: {
  rotulo: string;
  /** Cifra en tamaño de texto (muestra corta): no gritar un 100 % de 5. */
  pequena?: boolean;
  color: string;
  titular: string;
  cifra: string;
  pie: string;
  enlace?: { href: string; rotulo: string };
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:rounded-3xl md:p-5">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        {rotulo}
      </p>
      <p className="mt-2 break-words text-sm font-semibold leading-snug text-white/90 md:text-[15px]">{titular}</p>
      <p
        className={`mt-2 font-semibold tabular-nums leading-none ${pequena ? "text-xl" : "text-3xl"}`}
        style={{ color }}
      >
        {cifra}
      </p>
      <p className="mt-2 text-xs leading-snug text-white/55">{pie}</p>
      {enlace ? (
        <Link
          href={enlace.href}
          className="mt-2 inline-block text-xs font-semibold underline underline-offset-2"
          style={{ color: "var(--rmcf-gold-ink)" }}
        >
          {enlace.rotulo}
        </Link>
      ) : null}
    </article>
  );
}

export function LecturaRapida({
  lectura,
  unidad,
  acierto,
  objetivo,
  tarea,
  mejorAlto = true,
  className = "",
}: {
  lectura: Lectura | null;
  /** «acciones», «saques». */
  unidad: string;
  /** Lo que se cuenta, dicho tras la cifra: «en gol u ocasión», «retenidos». */
  acierto: string;
  /**
   * El objetivo de partido de la tarea, sacado de un dato: la media de las
   * jornadas anteriores en lo mismo que mide la tarjeta. Sin dato no se pone.
   */
  objetivo?: { tasa: number; fuente: string } | null;
  /** Dónde vive la tarea en la plataforma (el microciclo de ABP). */
  tarea?: { href: string; rotulo: string };
  /** En las defensivas que miden el peligro concedido, el objetivo es un techo. */
  mejorAlto?: boolean;
  className?: string;
}) {
  if (!lectura) return null;

  const { base } = lectura;
  const funciona = lectura.funciona && lectura.funciona.n >= MUESTRA_VISIBLE ? lectura.funciona : null;
  const falla = lectura.falla && lectura.falla.n >= MUESTRA_VISIBLE ? lectura.falla : null;
  const entrenar = lectura.entrenar && falla ? lectura.entrenar : null;

  const gris = "var(--rmcf-rate-none)";
  const indicio = (h: HallazgoLectura) => h.n < MUESTRA_FIRME;

  const pieDe = (h: HallazgoLectura) =>
    `${h.aciertos} de ${h.n} ${unidad} ${acierto} · los otros ${base.n - h.n}, ${pct(h.tasaResto)}`;

  const hayIndicio = [funciona, falla].some((h) => h && indicio(h));

  if (!funciona && !falla) return null;

  return (
    <section aria-label="Lectura rápida" className={`min-w-0 ${className}`}>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 md:gap-4">
        {funciona && (
          <Tarjeta
            rotulo={indicio(funciona) ? "Indicio a favor" : "Qué funciona"}
            color={indicio(funciona) ? gris : "var(--rmcf-rate-good)"}
            titular={`${capital(funciona.dimension)}: ${funciona.valor}`}
            cifra={indicio(funciona) ? `${funciona.aciertos} de ${funciona.n} · tendencia` : pct(funciona.tasa)}
            pequena={indicio(funciona)}
            pie={pieDe(funciona)}
          />
        )}
        {falla && (
          <Tarjeta
            rotulo={indicio(falla) ? "Indicio en contra" : "Qué falla"}
            color={indicio(falla) ? gris : "var(--rmcf-rate-low)"}
            titular={`${capital(falla.dimension)}: ${falla.valor}`}
            cifra={indicio(falla) ? `${falla.aciertos} de ${falla.n} · tendencia` : pct(falla.tasa)}
            pequena={indicio(falla)}
            pie={pieDe(falla)}
          />
        )}
        {entrenar && (
          <Tarjeta
            rotulo={indicio(entrenar.hallazgo) ? "Qué entrenar (si se confirma)" : "Qué entrenar"}
            color={indicio(entrenar.hallazgo) ? gris : "var(--rmcf-gold-ink)"}
            titular={entrenar.titulo}
            cifra={`${objetivo ? pct(objetivo.tasa) : pct(entrenar.hallazgo.tasaResto)}${indicio(entrenar.hallazgo) ? ` · provisional, ${entrenar.hallazgo.n} ${unidad}` : ""}`}
            pequena={indicio(entrenar.hallazgo)}
            pie={
              objetivo
                ? `Objetivo de partido: ${mejorAlto ? "" : "como mucho "}${pct(objetivo.tasa)} ${acierto} (${objetivo.fuente}). En la tarea se cuentan los ${unidad} ${acierto}; hoy, ${entrenar.hallazgo.aciertos} de ${entrenar.hallazgo.n}.`
                : `Objetivo: ${mejorAlto ? "" : "no pasar de "}lo que rinden los otros ${base.n - entrenar.hallazgo.n} ${unidad} (${pct(entrenar.hallazgo.tasaResto)}). En la tarea se cuentan los ${unidad} ${acierto}; hoy, ${entrenar.hallazgo.aciertos} de ${entrenar.hallazgo.n}.`
            }
            enlace={tarea}
          />
        )}
        <Tarjeta
          rotulo="Base"
          color="var(--rmcf-rate-none)"
          titular={`${base.n} ${unidad} en ${base.jornadas} ${base.jornadas === 1 ? "jornada" : "jornadas"}`}
          cifra={pct(base.tasa)}
          pie={`${base.aciertos} de ${base.n} ${acierto}, con los filtros de arriba`}
        />
      </div>
      {/* Un solo aviso de muestra para todo el bloque, no uno por tarjeta. */}
      {hayIndicio ? (
        <p className="mt-2 px-1 text-[11px] text-white/45">
          En gris, grupos de menos de {MUESTRA_FIRME} {unidad}: tendencia que hay que confirmar, no fortaleza ni carencia.
        </p>
      ) : null}
    </section>
  );
}
