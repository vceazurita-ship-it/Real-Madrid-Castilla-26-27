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
/*
| 10/11/2026 (jueces): un indicio contra un resto minúsculo («1 de 9 · los
| otros: 1 de 3») no compara nada. Si el grupo es indicio y el resto con dato
| no llega a esto, la tarjeta no se pinta.
*/
const RESTO_MINIMO = 10;

function capital(texto: string) {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto;
}

/*
| «Receptor: receptor «Primera línea»» repetía la palabra (10/11/2026): si el
| valor ya empieza por el nombre de la dimensión, va solo.
*/
function titularDe(h: HallazgoLectura) {
  const quita = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  return quita(h.valor).startsWith(quita(h.dimension)) ? capital(h.valor) : `${capital(h.dimension)}: ${h.valor}`;
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
  const indicio = (h: HallazgoLectura) => h.n < MUESTRA_FIRME;
  const visible = (h: HallazgoLectura | null) =>
    h && h.n >= MUESTRA_VISIBLE && !(indicio(h) && h.resto < RESTO_MINIMO) ? h : null;
  const funciona = visible(lectura.funciona);
  const falla = visible(lectura.falla);
  const entrenar = lectura.entrenar && falla ? lectura.entrenar : null;

  const gris = "var(--rmcf-rate-none)";

  /* La misma cuenta en las dos mitades: «2 de 6 · los otros: 9 de 11 (82 %)». */
  const pieDe = (h: HallazgoLectura) =>
    `${h.aciertos} de ${h.n} ${unidad} ${acierto} · los otros: ${h.aciertosResto} de ${h.resto} (${pct(h.tasaResto)})`;

  const hayIndicio = [funciona, falla].some((h) => h && indicio(h));

  if (!funciona && !falla) return null;

  return (
    <section aria-label="Lectura rápida" className={`min-w-0 ${className}`}>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 md:gap-4">
        {funciona && (
          <Tarjeta
            rotulo={indicio(funciona) ? "Indicio a favor" : "Qué funciona"}
            color={indicio(funciona) ? gris : "var(--rmcf-rate-good)"}
            titular={titularDe(funciona)}
            cifra={indicio(funciona) ? `${funciona.aciertos} de ${funciona.n} · tendencia` : pct(funciona.tasa)}
            pequena={indicio(funciona)}
            pie={pieDe(funciona)}
          />
        )}
        {falla && (
          <Tarjeta
            rotulo={indicio(falla) ? "Indicio en contra" : "Qué falla"}
            color={indicio(falla) ? gris : "var(--rmcf-rate-low)"}
            titular={titularDe(falla)}
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
            /* 10/11/2026 (jueces): en grande lo de hoy; el objetivo, al lado y con su fuente.
               El 69 % grande parecía el dato del partido y era el objetivo. */
            cifra={`${entrenar.hallazgo.aciertos} de ${entrenar.hallazgo.n} ${acierto}`}
            pequena
            pie={
              objetivo
                ? `Objetivo de partido: ${mejorAlto ? "" : "como mucho "}${pct(objetivo.tasa)} ${acierto} (${objetivo.fuente}). En la tarea se cuentan los ${unidad} ${acierto}.${indicio(entrenar.hallazgo) ? ` Provisional: ${entrenar.hallazgo.n} ${unidad}.` : ""}`
                : `Objetivo: ${mejorAlto ? "" : "no pasar de "}lo que rinden los otros (${entrenar.hallazgo.aciertosResto} de ${entrenar.hallazgo.resto}, ${pct(entrenar.hallazgo.tasaResto)}). En la tarea se cuentan los ${unidad} ${acierto}.${indicio(entrenar.hallazgo) ? ` Provisional: ${entrenar.hallazgo.n} ${unidad}.` : ""}`
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
