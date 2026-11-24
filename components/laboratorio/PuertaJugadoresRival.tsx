"use client";

import { PuertaAdmin } from "@/components/admin/PuertaAdmin";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useAdmin } from "@/hooks/useAdmin";

/** Sin sesión de administrador, /laboratorio/jugadores-rival pinta sólo esto (24/11/2026). */
export function PuertaJugadoresRival() {
  const { entra } = useAdmin();

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />
        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <div className="mx-auto w-full max-w-md px-4 py-12">
            <PuertaAdmin
              titulo="Vídeo de los jugadores rivales"
              texto="Sólo el administrador. Usuario y contraseña."
              onEntra={entra}
              onDentro={() => window.location.reload()}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
