"use client";

/**
 * /entrar (18/11/2026): la puerta de la plataforma. Dos maneras de entrar:
 *   - Cuerpo técnico: la misma cuenta de la quiniela (correo y contraseña).
 *     Darse de alta pide el código del cuerpo técnico.
 *   - Jugadores (19/11/2026): cada uno su usuario (nombre y primer apellido)
 *     y su contraseña (nombre123), lib/acceso/jugadores.ts. Ven la plataforma
 *     sin lo que rellena el staff (lib/acceso/rutas.ts).
 * Al entrar se vuelve a la pantalla que se pidió (?volver=).
 */
import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Shirt, Users } from "lucide-react";
import { toast } from "sonner";

import { Acceso } from "@/components/quiniela/Acceso";
import { Button, Segmented } from "@/components/abp/ui";
import { useQuinielaSesion } from "@/hooks/useQuinielaSesion";

/** Sólo rutas de la propia web: nada de `//otro-sitio` ni `https://…`. */
const destinoSeguro = (v: string | null) => (v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/entrar") ? v : "/");

function Puerta() {
  const params = useSearchParams();
  const volver = destinoSeguro(params.get("volver"));
  const [lado, setLado] = useState<"staff" | "jugador">(params.get("jugador") === "1" ? "jugador" : "staff");
  const { yo, cargando, manda } = useQuinielaSesion();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [enviando, setEnviando] = useState(false);

  /* Recién entrado como staff: a donde iba. Navegación completa, para que el proxy lea la cookie nueva. */
  useEffect(() => {
    if (yo) window.location.replace(volver);
  }, [yo, volver]);

  const entraJugador = async () => {
    if (!usuario.trim() || !contrasena.trim()) return toast.error("Escribe tu usuario y tu contraseña.");
    setEnviando(true);
    try {
      const r = await fetch("/api/acceso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "jugador", usuario, contrasena }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || "No se ha podido entrar.");
      window.location.replace("/jugadores");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se ha podido entrar.");
      setEnviando(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0B0F14] px-4 py-10 text-white">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/logo.png" alt="" width={72} height={72} priority className="h-[72px] w-[72px] object-contain" />
          <h1 className="mt-3 text-2xl font-black uppercase tracking-[0.12em] text-[#C8A96B]">Real Madrid Castilla</h1>
          <p className="mt-1 text-[13px] text-white/60">Plataforma integral · temporada 2026-2027</p>
        </div>

        <div className="mb-3 flex justify-center">
          <Segmented
            ariaLabel="Quién entra"
            value={lado}
            onChange={setLado}
            options={[
              { key: "staff", label: "Cuerpo técnico" },
              { key: "jugador", label: "Jugadores" },
            ]}
          />
        </div>

        {lado === "staff" ? (
          <Acceso
            yo={yo}
            cargando={cargando}
            manda={manda}
            titulo="Entra con tu cuenta"
            subtitulo="La misma de la quiniela. Para darte de alta te hace falta el código del cuerpo técnico."
            botonEntrar="Entrar"
            sinPista
            apilado
            pie={<>Si no recuerdas la contraseña, pídela a Víctor.</>}
          />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void entraJugador();
            }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-white">
              <Shirt size={16} className="text-[#C8A96B]" aria-hidden /> Acceso de jugadores
            </p>
            <p className="mt-1 text-[13px] text-white/60">Usuario: tu nombre y tu primer apellido. Verás los rivales, el balón parado y los goles.</p>
            <label className="mt-4 block text-[12px] font-semibold text-white/70">
              Usuario
              <input
                type="text"
                autoComplete="username"
                autoCapitalize="words"
                placeholder="Nombre Apellido"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2.5 text-[15px] text-white placeholder:text-white/30"
              />
            </label>
            <label className="mt-3 block text-[12px] font-semibold text-white/70">
              Contraseña
              <input
                type="password"
                autoComplete="current-password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2.5 text-[15px] text-white"
              />
            </label>
            <div className="mt-4">
              <Button type="submit" tone="primary" icon={Users} disabled={enviando}>
                {enviando ? "Un momento…" : "Entrar"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

export default function EntrarPage() {
  return (
    <Suspense>
      <Puerta />
    </Suspense>
  );
}
