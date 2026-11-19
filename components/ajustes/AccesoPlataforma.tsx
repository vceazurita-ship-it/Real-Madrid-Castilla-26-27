"use client";

/**
 * Ajustes → Acceso (18/11/2026): la puerta de la plataforma
 * (lib/acceso/codigos.ts). Sólo el administrador (la ruta lo comprueba).
 * 19/11/2026: los jugadores ya no comparten código; cada uno entra con su
 * usuario y su contraseña (lib/acceso/jugadores.ts). Aquí se abre o se cierra
 * su acceso y se ve la lista para pasársela.
 */
import { useEffect, useState } from "react";
import { KeyRound, Lock, Shirt, Unlock, UserX } from "lucide-react";

import { Button, Notice, Panel } from "@/components/abp/ui";
import { aviso, enPalabras } from "@/lib/avisos";
import { PANTALLAS_JUGADOR } from "@/lib/acceso/rutas";
import { contrasenaDe, CUENTAS_JUGADORES } from "@/lib/acceso/jugadores";

type Estado = { hayCodigoJugadores: boolean; hayCodigoStaff: boolean };

const llama = async (cuerpo: Record<string, unknown>) => {
  const r = await fetch("/api/acceso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Partial<Estado>;
  if (!r.ok || !j.ok) throw new Error(j.error || "No se ha podido guardar.");
  return j;
};

function Jugadores({ abierto, onCambia }: { abierto: boolean; onCambia: (e: Estado) => void }) {
  const [enviando, setEnviando] = useState(false);
  const cambia = async () => {
    setEnviando(true);
    try {
      const j = await llama({ accion: "jugadores", abierto: !abierto });
      onCambia({ hayCodigoJugadores: Boolean(j.hayCodigoJugadores), hayCodigoStaff: Boolean(j.hayCodigoStaff) });
      aviso.exito(abierto ? "Acceso de jugadores cerrado" : "Acceso de jugadores abierto");
    } catch (e) {
      aviso.error(enPalabras(e));
    } finally {
      setEnviando(false);
    }
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-white">
        <Shirt size={16} className="text-[#C8A96B]" aria-hidden /> Acceso de jugadores
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${abierto ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"}`}>{abierto ? "Abierto" : "Cerrado"}</span>
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-white/60">
        Cada jugador entra con su usuario (nombre y primer apellido) y su contraseña (su nombre y 123). Da igual mayúsculas y tildes. Al cerrarlo, los que estén dentro salen en 5 minutos.
      </p>
      <div className="mt-3">
        <Button tone={abierto ? undefined : "primary"} icon={abierto ? Lock : Unlock} disabled={enviando} onClick={() => void cambia()}>
          {abierto ? "Cerrar el acceso" : "Abrir el acceso"}
        </Button>
      </div>
    </div>
  );
}

function Cuentas() {
  return (
    <details className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <summary className="cursor-pointer text-sm font-bold text-white">Usuarios y contraseñas de los jugadores ({CUENTAS_JUGADORES.length})</summary>
      <ul className="mt-3 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
        {CUENTAS_JUGADORES.map((c) => (
          <li key={c.id} className="flex justify-between gap-3 border-b border-white/5 py-1">
            <span className="text-white">{c.usuario}</span>
            <span className="font-mono text-white/60">{contrasenaDe(c.usuario)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-white/45">Un fichaje nuevo se añade en el código (lib/acceso/jugadores.ts): pídeselo a Claude.</p>
    </details>
  );
}

function Codigo({ titulo, texto, hay, lado, onCambia, icono: Icono }: { titulo: string; texto: string; hay: boolean; lado: "staff"; onCambia: (e: Estado) => void; icono: typeof Shirt }) {
  const [valor, setValor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const guarda = async (codigo: string) => {
    setEnviando(true);
    try {
      const j = await llama({ accion: "codigos", [lado]: codigo });
      onCambia({ hayCodigoJugadores: Boolean(j.hayCodigoJugadores), hayCodigoStaff: Boolean(j.hayCodigoStaff) });
      setValor("");
      aviso.exito(codigo ? "Código guardado" : "Código quitado");
    } catch (e) {
      aviso.error(enPalabras(e));
    } finally {
      setEnviando(false);
    }
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-white">
        <Icono size={16} className="text-[#C8A96B]" aria-hidden /> {titulo}
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${hay ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"}`}>{hay ? "Puesto" : "Sin poner"}</span>
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-white/60">{texto}</p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valor.trim().length < 6) return aviso.error("Al menos 6 caracteres.");
          void guarda(valor.trim());
        }}
      >
        <input
          type="text"
          autoComplete="off"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={hay ? "Nuevo código (cambia el actual)" : "Código nuevo, 6 caracteres o más"}
          aria-label={titulo}
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-[14px] text-white placeholder:text-white/35"
        />
        <Button type="submit" tone="primary" icon={KeyRound} disabled={enviando}>
          {hay ? "Cambiar" : "Poner"}
        </Button>
        {hay && (
          <Button type="button" disabled={enviando} onClick={() => void guarda("")}>
            Quitar
          </Button>
        )}
      </form>
    </div>
  );
}

export function AccesoPlataforma() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [echando, setEchando] = useState(false);

  useEffect(() => {
    fetch("/api/acceso")
      .then((r) => r.json())
      .then((j: Estado) => setEstado({ hayCodigoJugadores: Boolean(j.hayCodigoJugadores), hayCodigoStaff: Boolean(j.hayCodigoStaff) }))
      .catch(() => setEstado({ hayCodigoJugadores: false, hayCodigoStaff: false }));
  }, []);

  if (!estado) return <p className="mt-6 text-sm text-white/40">Mirando los códigos…</p>;

  return (
    <div className="mt-6 grid gap-4">
      <Panel title="Quién entra en la plataforma" subtitle="Desde el 18/11/2026 hay que entrar: el cuerpo técnico con su cuenta (la de la quiniela) y cada jugador con su usuario." icon={KeyRound}>
        <div className="grid gap-3 lg:grid-cols-2">
          <Jugadores abierto={estado.hayCodigoJugadores} onCambia={setEstado} />
          <Codigo
            lado="staff"
            icono={KeyRound}
            titulo="Código del cuerpo técnico"
            hay={estado.hayCodigoStaff}
            onCambia={setEstado}
            texto="Lo pide «Registrarme» al darse de alta alguien del staff. Sin él no se puede crear una cuenta nueva (los que ya la tienen entran igual)."
          />
        </div>
        <Cuentas />
        {estado.hayCodigoJugadores && (
          <div className="mt-3">
            <Button
              icon={UserX}
              disabled={echando}
              onClick={() => {
                setEchando(true);
                llama({ accion: "echar-jugadores" })
                  .then(() => aviso.exito("Hecho: los jugadores tendrán que volver a entrar"))
                  .catch((e) => aviso.error(enPalabras(e)))
                  .finally(() => setEchando(false));
              }}
            >
              Sacar a todos los jugadores
            </Button>
          </div>
        )}
      </Panel>

      <Notice tone="info" title="Lo que ven los jugadores">
        Sólo estas pantallas: {PANTALLAS_JUGADOR.filter((p) => p !== "/jugadores").join(", ")}. Nada de seguimientos, valoraciones, pizarras (táctica, de sesión y de ABP), emocional, carga física, planes e informes, coding, visionados, tareas, alertas, quiniela, apuestas, laboratorio ni Ajustes: ni en la pantalla ni pidiendo los datos a mano.
      </Notice>
    </div>
  );
}
