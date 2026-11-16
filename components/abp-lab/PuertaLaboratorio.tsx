"use client";

/**
 * LA PUERTA DEL LABORATORIO DE ABP (07/11/2026).
 *
 * Sin sesión de administrador, `app/laboratorio/abp/layout.tsx` pinta esto en
 * la misma dirección en lugar de mandar a Ajustes. Así quien llega sabe dónde
 * está («Laboratorio de ABP · Balón parado») y, al entrar, la página se
 * recarga con su consulta intacta (?seccion=jornada, ?accion=…): un enlace
 * desde Data análisis abre la misma acción después de entrar.
 *
 * 10/11/2026: el laboratorio sale en el menú para todos y, a quien llega sin
 * ser el administrador, le salta un aviso en ventana: no tiene acceso, sólo
 * entra el usuario v.ceazurita@gmail.com. Lo pidió así el analista (con su
 * correo a la vista); un experto propuso quitar la ventana y NO se quita.
 * «Soy yo» la cierra y lleva al formulario (no abre otro).
 *
 * 16/11/2026 (jueces): el panel de detrás ya no repite el aviso (sólo el
 * formulario) ni lleva un segundo «Volver a ABP Ofensivo»: la vuelta está en
 * la ventana. Y en lugar de tres bocetos, una MUESTRA REAL de cada
 * herramienta, pintada con el mismo código del laboratorio y con material
 * público (una rutina del Arsenal ya citada en `referentes.ts` y una pregunta
 * del banco, con su fuente). Nada del documento del laboratorio, del rival ni
 * de la plantilla sale sin sesión.
 */

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { AbpHeader } from "@/components/abp/ui";
import type { JugadorLab } from "@/components/abp-lab/comun";
import { MiniPizarra } from "@/components/abp-lab/PizarraRutina";
import { PuertaAdmin } from "@/components/admin/PuertaAdmin";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useAdmin } from "@/hooks/useAdmin";
import { ESQUEMAS } from "@/lib/abp-lab/esquemas";
import { BANCO, DEFENSAS } from "@/lib/abp-lab/modelo";
import { REFERENTES } from "@/lib/abp-lab/referentes";
import { encajeSistemas } from "@/lib/abp-lab/ventaja";
import { comaXg } from "@/lib/abp-lab/xg";

const MUESTRA_ID = "arsenal-spurs";

const MUESTRA = REFERENTES.flatMap((r) => r.rutinas).find((r) => r.id === MUESTRA_ID) ?? null;

const ESQUEMA = ESQUEMAS[MUESTRA_ID];

const SIN_JUGADORES = new Map<string, JugadorLab>();

const PREGUNTA = BANCO[0];

const etiquetaDefensa = (d: string) => (DEFENSAS.find((x) => x.key === d)?.label ?? d).replace(/^Contra /, "");

function MuestraPizarra() {
  if (!ESQUEMA || !MUESTRA) return null;

  return (
    <div className="overflow-hidden rounded-lg">
      <MiniPizarra
        rutina={{ nombre: MUESTRA.nombre, senal: "", tipo: "corner", lado: "ofensivo", contra: "cualquiera", roles: ESQUEMA.roles, balon: ESQUEMA.balon }}
        porId={SIN_JUGADORES}
      />
    </div>
  );
}

/* La misma rutina contra los tres sistemas defensivos, con el modelo del laboratorio (sin datos de nadie). */
function MuestraEncaje() {
  const encaje = useMemo(
    () => (ESQUEMA ? encajeSistemas({ roles: ESQUEMA.roles, balon: ESQUEMA.balon, tipo: "corner" }, null, () => null) : []),
    [],
  );

  if (!encaje.length) return null;

  const tope = Math.max(...encaje.map((e) => e.xg), 0.01);

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Goles esperados del remate</p>
      {encaje.map((e, i) => (
        <div key={e.defensa} className="grid grid-cols-[4.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-[12px]">
          <span className="text-white/70">{etiquetaDefensa(e.defensa)}</span>
          <span className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <span
              className="block h-full rounded-full bg-[#C8A96B]"
              style={{ width: `${Math.round((e.xg / tope) * 100)}%`, opacity: i === 0 ? 1 : 0.5 }}
            />
          </span>
          <span className="text-right font-semibold tabular-nums text-white">{comaXg(e.xg)}</span>
        </div>
      ))}
    </div>
  );
}

/* Una pregunta del banco tal cual sale en el proyector, con la respuesta marcada. */
function MuestraReto() {
  if (!PREGUNTA) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[13px] font-medium leading-snug text-white">{PREGUNTA.enunciado}</p>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {PREGUNTA.opciones.map((o, i) => (
          <li
            key={o}
            className={`rounded-md border px-2 py-1 text-[12px] leading-snug ${
              i === PREGUNTA.correcta ? "border-[#C8A96B]/60 bg-[#C8A96B]/15 font-semibold text-white" : "border-white/10 text-white/65"
            }`}
          >
            {o}
          </li>
        ))}
      </ul>
      {PREGUNTA.explicacion && <p className="mt-2 text-[12px] leading-snug text-white/60">{PREGUNTA.explicacion}</p>}
    </div>
  );
}

const FUENTE = MUESTRA ? `${MUESTRA.fuente.medio}${MUESTRA.fuente.fecha ? `, ${MUESTRA.fuente.fecha.slice(0, 4)}` : ""}` : "";

const HERRAMIENTAS: { titulo: string; texto: string; pie: string; muestra: ReactNode }[] = [
  {
    titulo: "Pizarra viva",
    texto: "La rutina en metros: de dónde sale cada uno, su carrera y el vuelo del balón, en cenital, vista de televisión o a pie de campo.",
    pie: MUESTRA ? `Muestra: «${MUESTRA.nombre}», del Arsenal contra el ${MUESTRA.contra} (${FUENTE}).` : "",
    muestra: <MuestraPizarra />,
  },
  {
    titulo: "Encaje con el rival",
    texto: "Cuánto vale el remate de la rutina contra zona, mixta y hombre, y qué concede a balón parado el próximo rival en nuestra liga.",
    pie: "Muestra: esa misma rutina contra los tres sistemas, con el modelo del laboratorio.",
    muestra: <MuestraEncaje />,
  },
  {
    titulo: "Retos de proyector",
    texto: "Preguntas a pantalla completa para la plantilla, con cuenta atrás y clasificación de quién acierta.",
    pie: PREGUNTA?.fuente ? `Pregunta del banco · ${PREGUNTA.fuente.titulo}.` : "",
    muestra: <MuestraReto />,
  },
];

export function PuertaLaboratorio() {
  const { entra } = useAdmin();
  const [aviso, setAviso] = useState(true);

  /* «Soy yo»: cierra la ventana y deja el cursor en el usuario, el único camino de entrada. */
  const soyYo = () => {
    setAviso(false);
    window.requestAnimationFrame(() => {
      const campo = document.querySelector<HTMLInputElement>('#lab-abp-acceso input[name="username"]');
      campo?.focus();
      campo?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-h-screen min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="flex min-w-0 flex-1 flex-col px-4 pb-24 pt-6 sm:px-6 sm:pb-10 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Balón parado"
              title="Prueba una rutina de córner contra el próximo rival"
              lead="Monta la jugada, mira cómo encaja con el rival y llévala al proyector."
            />

            <div className="mt-6 grid min-w-0 max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
              <div id="lab-abp-acceso" className="min-w-0 lg:sticky lg:top-6 lg:order-2">
                <PuertaAdmin
                  titulo="Entrar en el laboratorio"
                  texto="Usuario y contraseña del administrador."
                  onEntra={entra}
                  onDentro={() => window.location.reload()}
                />
              </div>

              <ul className="grid min-w-0 gap-3 lg:order-1">
                {HERRAMIENTAS.map(({ titulo, texto, pie, muestra }) => (
                  <li
                    key={titulo}
                    className="grid min-w-0 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:items-center"
                  >
                    <div className="min-w-0">{muestra}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{titulo}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-white/70">{texto}</p>
                      {pie && <p className="mt-2 text-[11px] leading-snug text-white/50">{pie}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      {aviso && (
        <div className="modal-veil fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="lab-abp-sin-acceso"
            className="w-full max-w-md rounded-t-2xl border border-white/10 bg-[#11161C] p-5 shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-[#D8B45A]" aria-hidden />
              <h2 id="lab-abp-sin-acceso" className="text-base font-semibold text-white">
                No tienes acceso al Laboratorio de ABP
              </h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              De momento sólo puede entrar el usuario <span className="font-semibold text-white">v.ceazurita@gmail.com</span>. Si
              necesitas algo de aquí, pídeselo a Víctor. Detrás de esta ventana tienes una muestra de lo que hace.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/setpieces" className="inline-flex min-h-11 items-center rounded-full bg-[#D8B45A] px-4 text-sm font-semibold text-[#0B0F14]">
                Volver a ABP Ofensivo
              </Link>
              <button
                type="button"
                onClick={soyYo}
                className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-sm text-white/80 hover:text-white"
              >
                Soy yo: poner la contraseña
              </button>
              <button
                type="button"
                onClick={() => setAviso(false)}
                className="inline-flex min-h-11 items-center px-2 text-sm text-white/60 underline underline-offset-4 hover:text-white"
              >
                Ver la muestra
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
