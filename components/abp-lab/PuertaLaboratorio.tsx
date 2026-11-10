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
 * «Soy yo, entrar» la cierra y deja el acceso. Cada herramienta lleva un
 * dibujo de lo que hace, sin datos del rival: el contenido no sale sin sesión.
 */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { AbpHeader } from "@/components/abp/ui";
import { PuertaAdmin } from "@/components/admin/PuertaAdmin";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useAdmin } from "@/hooks/useAdmin";

/* Medio campo visto desde la línea de fondo: área, área pequeña y portería. */
function MedioCampo({ children }: { children?: ReactNode }) {
  return (
    <svg viewBox="0 0 120 72" className="h-auto w-full text-white/35" aria-hidden>
      <rect x="1" y="1" width="118" height="70" rx="4" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="1" />
      <rect x="30" y="1" width="60" height="26" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="46" y="1" width="28" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M48 27a12 8 0 0 0 24 0" fill="none" stroke="currentColor" strokeWidth="1" />
      {children}
    </svg>
  );
}

/* Pizarra viva: sacador en la esquina, envío al punto de penalti y dos desmarques. */
function DibujoPizarra() {
  return (
    <MedioCampo>
      <circle cx="4" cy="4" r="3" fill="#D8B45A" />
      <path d="M6 6 Q40 30 58 20" fill="none" stroke="#D8B45A" strokeWidth="1.4" strokeDasharray="3 2" />
      <circle cx="44" cy="40" r="3" fill="#D8B45A" />
      <path d="M44 37 L52 22" fill="none" stroke="#D8B45A" strokeWidth="1.2" />
      <circle cx="76" cy="42" r="3" fill="#D8B45A" />
      <path d="M76 39 L66 22" fill="none" stroke="#D8B45A" strokeWidth="1.2" />
      <circle cx="60" cy="14" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="70" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </MedioCampo>
  );
}

/* Encaje con el rival: las zonas del área, la atacada resaltada. */
function DibujoEncaje() {
  return (
    <MedioCampo>
      <rect x="30" y="1" width="20" height="26" fill="currentColor" fillOpacity="0.12" />
      <rect x="50" y="1" width="20" height="26" fill="#D8B45A" fillOpacity="0.45" />
      <rect x="70" y="1" width="20" height="26" fill="currentColor" fillOpacity="0.12" />
      <path d="M60 46 L60 30" stroke="#D8B45A" strokeWidth="1.6" markerEnd="url(#punta-encaje)" />
      <defs>
        <marker id="punta-encaje" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill="#D8B45A" />
        </marker>
      </defs>
    </MedioCampo>
  );
}

/* Retos de proyector: la jugada en pantalla y tres respuestas para la plantilla. */
function DibujoRetos() {
  return (
    <svg viewBox="0 0 120 72" className="h-auto w-full text-white/35" aria-hidden>
      <rect x="1" y="1" width="118" height="46" rx="4" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="1" />
      <circle cx="40" cy="24" r="3" fill="#D8B45A" />
      <circle cx="62" cy="18" r="3" fill="#D8B45A" />
      <circle cx="80" cy="30" r="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <text x="96" y="30" fontSize="18" fontWeight="700" fill="#D8B45A">?</text>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={4 + i * 39} y="54" width="34" height="14" rx="7" fill="none" stroke="currentColor" strokeWidth="1" />
      ))}
      <rect x="43" y="54" width="34" height="14" rx="7" fill="#D8B45A" fillOpacity="0.45" />
    </svg>
  );
}

const HERRAMIENTAS: { titulo: string; texto: string; dibujo: ReactNode }[] = [
  { titulo: "Pizarra viva", texto: "La rutina en metros, con jugadores que se mueven.", dibujo: <DibujoPizarra /> },
  { titulo: "Encaje con el rival", texto: "Qué zona de su defensa ataca cada rutina.", dibujo: <DibujoEncaje /> },
  { titulo: "Retos de proyector", texto: "Preguntas para la plantilla sobre la jugada.", dibujo: <DibujoRetos /> },
];

export function PuertaLaboratorio() {
  const { entra } = useAdmin();
  const [aviso, setAviso] = useState(true);

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

            <div className="mt-6 grid max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
              <div className="flex flex-col items-stretch gap-3 lg:order-2">
                <PuertaAdmin
                  titulo="Entrar en el laboratorio"
                  texto="Sólo entra el administrador del cuerpo técnico. Si necesitas algo de aquí, pídeselo a Víctor."
                  onEntra={entra}
                  onDentro={() => window.location.reload()}
                />
                <Link
                  href="/setpieces"
                  className="mx-auto inline-flex min-h-11 items-center text-sm text-white/65 underline underline-offset-4 hover:text-white"
                >
                  Volver a ABP Ofensivo
                </Link>
              </div>

              <ul className="grid gap-3 sm:grid-cols-3 lg:order-1 lg:grid-cols-1">
                {HERRAMIENTAS.map(({ titulo, texto, dibujo }) => (
                  <li
                    key={titulo}
                    className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 lg:flex-row lg:items-center"
                  >
                    <div className="w-full shrink-0 lg:w-40">{dibujo}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{titulo}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-white/65">{texto}</p>
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
              necesitas algo de aquí, pídeselo a Víctor.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/setpieces" className="inline-flex min-h-11 items-center rounded-full bg-[#D8B45A] px-4 text-sm font-semibold text-[#0B0F14]">
                Volver a ABP Ofensivo
              </Link>
              <button
                type="button"
                onClick={() => setAviso(false)}
                className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-sm text-white/80 hover:text-white"
              >
                Soy yo, entrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
