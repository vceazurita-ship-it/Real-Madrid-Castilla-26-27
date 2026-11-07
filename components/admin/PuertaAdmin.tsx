"use client";

/**
 * LA PUERTA DEL ADMINISTRADOR (usuario y contraseña).
 *
 * La usan Ajustes y el Laboratorio de ABP. Hasta el 07/11/2026 vivía dentro
 * de Ajustes y el laboratorio mandaba allí: quien llegaba por un enlace veía
 * «Poner al día · Ajustes» y no sabía dónde estaba, y la vuelta perdía la
 * sección pedida (?seccion=, ?accion=). Ahora el laboratorio pinta su propia
 * puerta en su misma dirección y, al entrar, recarga la página tal cual.
 *
 * Criterios de los jueces (marketing): el botón no parece apagado con los
 * campos vacíos (se avisa al enviar), se puede ver la contraseña, Enter envía
 * y el error sale en español debajo de los campos.
 */

import { useState, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff, Loader2, Lock, LogIn } from "lucide-react";

export function PuertaAdmin({
  titulo,
  texto,
  onEntra,
  onDentro,
}: {
  titulo: string;
  texto: ReactNode;
  onEntra: (email: string, contrasena: string) => Promise<void>;
  /** Qué hacer al entrar (recargar, volver a otra pantalla…). */
  onDentro?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [verla, setVerla] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState("");

  const envia = async (e: FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !contrasena) {
      setError("Escribe el usuario y la contraseña.");
      return;
    }

    setEntrando(true);
    setError("");

    try {
      await onEntra(email.trim(), contrasena);
      onDentro?.();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se ha podido entrar.");
      setContrasena("");
    } finally {
      setEntrando(false);
    }
  };

  const campo =
    "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#C8A96B]/70";

  return (
    <form
      onSubmit={(e) => void envia(e)}
      noValidate
      className="mx-auto w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-6"
    >
      <div className="flex items-center gap-2.5">
        <Lock size={16} className="text-[#C8A96B]" aria-hidden />
        <h2 className="text-sm font-semibold text-white">{titulo}</h2>
      </div>

      <p className="mt-2 text-[13px] leading-relaxed text-white/65">{texto}</p>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-[11px] uppercase tracking-[0.16em] text-white/55">Usuario</span>
        <input
          type="email"
          name="username"
          autoComplete="username"
          inputMode="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(error) || undefined}
          className={campo}
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-[11px] uppercase tracking-[0.16em] text-white/55">Contraseña</span>
        <span className="relative block">
          <input
            type={verla ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            aria-invalid={Boolean(error) || undefined}
            className={`${campo} pr-11`}
          />
          <button
            type="button"
            onClick={() => setVerla((v) => !v)}
            aria-label={verla ? "Ocultar la contraseña" : "Mostrar la contraseña"}
            aria-pressed={verla}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/55 transition hover:text-white"
          >
            {verla ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        </span>
      </label>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={entrando}
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#C8A96B] bg-[#C8A96B] text-sm font-semibold text-black transition hover:bg-[#d8bc82] disabled:cursor-wait"
      >
        {entrando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <LogIn size={16} aria-hidden />}
        {entrando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
