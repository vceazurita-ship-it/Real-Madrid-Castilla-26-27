"use client";

/**
 * Botón «Seguir en directo» de Opta (09/11/2026): lanza en GitHub el proceso
 * que mira cada minuto los partidos de Primera RFEF del día, sin el ordenador
 * del club. Ver app/api/opta/directo y .github/workflows/opta-directo.yml.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Radio } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/abp/ui";
import { confirmar } from "@/lib/avisos";

type Estado = {
  preparado: boolean;
  ultima?: { estado: string; resultado: string | null; empezo: string; enlace: string } | null;
};

export function OptaDirecto({ deshabilitado }: { deshabilitado?: boolean }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [lanzando, setLanzando] = useState(false);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    let vivo = true;
    fetch("/api/opta/directo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => vivo && j?.success && setEstado({ preparado: !!j.preparado, ultima: j.ultima }))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [vuelta]);

  const lanza = async () => {
    const si = await confirmar({
      titulo: "Seguir la jornada en directo",
      texto: "GitHub mirará Opta cada minuto durante dos horas y media y lo irá dejando en Opta → Directo. No hace falta este ordenador.",
      aceptar: "Lanzar",
    });
    if (!si) return;

    setLanzando(true);
    try {
      const r = await fetch("/api/opta/directo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duracion: 150 }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.success) throw new Error(j?.error ?? "No se ha podido lanzar.");
      toast.success("Directo lanzado en GitHub", { description: "Tarda un minuto en arrancar." });
      setTimeout(() => setVuelta((v) => v + 1), 15_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se ha podido lanzar.");
    } finally {
      setLanzando(false);
    }
  };

  const enMarcha = !!estado?.ultima && estado.ultima.estado !== "completed";

  /* Mientras corre, se vuelve a mirar cada minuto: si no, el botón se quedaba
     en «En marcha» hasta recargar la página aunque el directo ya hubiera acabado. */
  useEffect(() => {
    if (!enMarcha) return;
    const reloj = setInterval(() => setVuelta((v) => v + 1), 60_000);
    return () => clearInterval(reloj);
  }, [enMarcha]);

  return (
    <div className="mt-4 rounded-xl border border-white/[0.07] px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-white/75">En directo, sin este ordenador</p>
        <Button
          icon={Radio}
          disabled={deshabilitado || lanzando || !estado?.preparado || !!enMarcha}
          onClick={() => void lanza()}
        >
          {enMarcha ? "En marcha" : lanzando ? "Lanzando…" : "Seguir en directo"}
        </Button>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-white/45">
        Corre en GitHub: mira cada minuto los partidos de Primera RFEF de hoy (el nuestro y los demás) y los
        deja en <Link href="/opta?tab=directo" className="underline">Opta → Directo</Link>.
      </p>

      {estado && !estado.preparado && (
        <p className="mt-2 text-[12px] leading-relaxed text-amber-200/80">
          Para activarlo: en GitHub, los secretos OPTA_USUARIO y OPTA_CLAVE; en Render, la variable
          GITHUB_TOKEN_DIRECTO (token con permiso de Actions).
        </p>
      )}

      {estado?.ultima && (
        <p className="mt-2 text-[12px] text-white/45">
          Última: {new Date(estado.ultima.empezo).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })} ·{" "}
          {estado.ultima.estado !== "completed"
            ? "en marcha"
            : estado.ultima.resultado === "success"
              ? "terminó bien"
              : estado.ultima.resultado === "cancelled"
                ? "cancelado"
                : "falló"}{" "}
          ·{" "}
          <a href={estado.ultima.enlace} target="_blank" rel="noreferrer" className="underline">
            ver en GitHub
          </a>
        </p>
      )}
    </div>
  );
}
