/*
| Las cuatro tarjetas de arriba de cada pantalla de balón parado (02/11/2026):
| qué funciona, qué falla, qué entrenar y sobre qué base. Las cuentas están en
| `lib/abp/lectura-rapida.ts`; aquí sólo se pintan. Lo que no sale de los
| datos no se pinta: sin hallazgo, no hay tarjeta (ni hueco, ni guion).
|
| Los colores van por las variables de la escala (`--rmcf-rate-*`), que ya
| tienen su versión de día: nada de verdes claros sobre panel blanco.
*/

import type { HallazgoLectura, LecturaRapida as Lectura } from "@/lib/abp/lectura-rapida";

const pct = (x: number) => `${Math.round(x * 100)} %`;

function capital(texto: string) {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto;
}

function Tarjeta({
  rotulo,
  color,
  titular,
  cifra,
  pie,
}: {
  rotulo: string;
  color: string;
  titular: string;
  cifra: string;
  pie: string;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:rounded-3xl md:p-5">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        {rotulo}
      </p>
      <p className="mt-2 break-words text-sm font-semibold leading-snug text-white/90 md:text-[15px]">{titular}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums leading-none" style={{ color }}>
        {cifra}
      </p>
      <p className="mt-2 text-xs leading-snug text-white/55">{pie}</p>
    </article>
  );
}

export function LecturaRapida({
  lectura,
  unidad,
  acierto,
  ganancia,
  className = "",
}: {
  lectura: Lectura | null;
  /** «acciones», «saques». */
  unidad: string;
  /** Lo que se cuenta, dicho tras la cifra: «en gol u ocasión», «retenidos». */
  acierto: string;
  /** Lo que gana el equipo si lo que falla rinde como el resto. */
  ganancia: (acciones: number) => string;
  className?: string;
}) {
  if (!lectura) return null;

  const { base, funciona, falla, entrenar } = lectura;

  const pieDe = (h: HallazgoLectura) =>
    `${h.aciertos} de ${h.n} ${unidad} ${acierto} · el resto, ${pct(h.tasaResto)}${h.n < 10 ? " · indicio" : ""}`;

  return (
    <section
      aria-label="Lectura rápida"
      className={`grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 md:gap-4 ${className}`}
    >
      {funciona && (
        <Tarjeta
          rotulo="Qué funciona"
          color="var(--rmcf-rate-good)"
          titular={`${capital(funciona.dimension)}: ${funciona.valor}`}
          cifra={pct(funciona.tasa)}
          pie={pieDe(funciona)}
        />
      )}
      {falla && (
        <Tarjeta
          rotulo="Qué falla"
          color="var(--rmcf-rate-low)"
          titular={`${capital(falla.dimension)}: ${falla.valor}`}
          cifra={pct(falla.tasa)}
          pie={pieDe(falla)}
        />
      )}
      {entrenar && (
        <Tarjeta
          rotulo="Qué entrenar"
          color="var(--rmcf-gold-ink)"
          titular={entrenar.titulo}
          cifra={String(Math.round(entrenar.hallazgo.impacto))}
          pie={ganancia(Math.round(entrenar.hallazgo.impacto))}
        />
      )}
      <Tarjeta
        rotulo="Base"
        color="var(--rmcf-rate-none)"
        titular={`${base.n} ${unidad} en ${base.jornadas} ${base.jornadas === 1 ? "jornada" : "jornadas"}`}
        cifra={pct(base.tasa)}
        pie={`${base.aciertos} de ${base.n} ${acierto}, con los filtros de arriba`}
      />
    </section>
  );
}
