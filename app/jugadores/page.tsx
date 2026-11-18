"use client";

/**
 * /jugadores (18/11/2026): el inicio del acceso de jugadores. Las mismas
 * entradas que su menú (components/ui/sidebar.tsx con `jugador`), en tarjetas,
 * y el botón de salir. Lo que no está aquí no lo pueden abrir (proxy.ts).
 */
import Link from "next/link";
import { LogOut } from "lucide-react";

import { Sidebar, entradasDelMenu } from "@/components/ui/sidebar";
import { Button } from "@/components/abp/ui";

const sale = async () => {
  await fetch("/api/acceso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "salir" }) }).catch(() => null);
  window.location.replace("/entrar?jugador=1");
};

export default function JugadoresPage() {
  const secciones = entradasDelMenu({ admin: false, ajustes: false, jugador: true }).filter((s) => !s.entradas.every((e) => e.href === "/jugadores"));

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-6 pt-20 sm:px-8 sm:py-10 lg:pt-10">
        <div className="mx-auto max-w-5xl">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C8A96B]">Real Madrid Castilla · Jugadores</p>
              <h1 className="mt-1 text-2xl font-black uppercase tracking-[0.06em] sm:text-3xl">Tu plataforma</h1>
              <p className="mt-1 max-w-xl text-[13px] text-white/60">El calendario, el viaje, nuestro modelo de juego, los rivales y el balón parado. Lo que prepara el cuerpo técnico para cada partido, a un toque.</p>
            </div>
            <Button icon={LogOut} onClick={() => void sale()}>
              Salir
            </Button>
          </header>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {secciones.map((s) => (
              <section key={s.titulo} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">{s.titulo}</h2>
                <ul className="mt-2 space-y-1">
                  {s.entradas.map((e) => (
                    <li key={e.href}>
                      <Link href={e.href} className="flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-[14px] font-semibold text-white/90 transition hover:bg-white/[0.06] hover:text-[#C8A96B]">
                        <e.icon size={17} className="shrink-0 text-[#C8A96B]" />
                        {e.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
