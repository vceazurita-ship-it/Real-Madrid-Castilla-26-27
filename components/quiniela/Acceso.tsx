"use client";

/**
 * ENTRAR CON LA CUENTA DE LA QUINIELA.
 *
 * Registrarse, entrar, salir y cambiar la contraseña. Vivía dentro de la
 * página de la quiniela; desde el 09/10/2026 lo comparten la quiniela y las
 * apuestas del staff, que juegan las mismas personas con la misma cuenta y la
 * misma sesión (`/api/quiniela/cuenta`).
 *
 * Al registrarse **la contraseña es lo que va antes de la @ del correo**, y se
 * dice en pantalla tal cual: nadie tiene que repartir contraseñas por WhatsApp.
 * A cambio no es secreta, así que mientras alguien no la cambie se le recuerda.
 */

import { useState } from "react";
import { KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button, Dialog, Notice, Panel, Segmented, Select } from "@/components/abp/ui";
import type { useQuinielaSesion, Yo } from "@/hooks/useQuinielaSesion";
import { STAFF } from "@/lib/quiniela/staff";

/** Un campo de texto con el tipo que haga falta: correo o contraseña. */
function Entrada({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </span>

      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(evento) => onChange(evento.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
      />
    </label>
  );
}

type Manda = ReturnType<typeof useQuinielaSesion>["manda"];

/**
 * Registrarse, entrar, salir y cambiar la contraseña.
 *
 * Al registrarse **la contraseña es lo que va antes de la @ del correo**, y se
 * dice en pantalla tal cual: nadie tiene que repartir contraseñas por WhatsApp.
 * A cambio no es secreta, así que mientras alguien no la cambie se le recuerda.
 */
export function Acceso({
  yo,
  cargando,
  manda,
  subtitulo = "Cada uno pone sólo lo suyo. Ver el ranking no necesita entrar",
}: {
  yo: Yo | null;
  cargando: boolean;
  manda: Manda;
  /** Lo que va bajo «Entra para apostar». */
  subtitulo?: string;
}) {
  const [modo, setModo] = useState<"entrar" | "registrar">("entrar");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [quien, setQuien] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [cambiando, setCambiando] = useState(false);

  const envia = async (cuerpo: Record<string, unknown>, exito: string) => {
    setEnviando(true);

    try {
      await manda(cuerpo);

      setClave("");
      toast.success(exito);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se ha podido");
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) {
    return (
      <Panel title="Tu cuenta" subtitle="Comprobando si ya habías entrado…" icon={KeyRound}>
        <div className="h-10" />
      </Panel>
    );
  }

  if (yo) {
    return (
      <Panel
        title={`Has entrado como ${yo.nombre}`}
        subtitle={yo.correo}
        icon={KeyRound}
        action={
          <div className="flex flex-wrap gap-2">
            <Button icon={KeyRound} onClick={() => setCambiando(true)}>
              Cambiar contraseña
            </Button>

            <Button
              icon={LogOut}
              disabled={enviando}
              onClick={() => void envia({ accion: "salir" }, "Has salido")}
            >
              Salir
            </Button>
          </div>
        }
      >
        {yo.inicial ? (
          <Notice tone="warn" title="Tu contraseña es la de registro">
            Es lo que va antes de la @ de tu correo, así que quien sepa tu
            correo puede entrar como tú. Cámbiala cuando puedas.
          </Notice>
        ) : (
          <p className="text-[11px] text-white/40">
            Sólo tú puedes poner y cambiar tu apuesta. La sesión dura un mes en
            este navegador.
          </p>
        )}

        {cambiando && (
          <CambiarClave manda={manda} onCerrar={() => setCambiando(false)} />
        )}
      </Panel>
    );
  }

  const registrando = modo === "registrar";

  const nombreCorreo = correo.includes("@") ? correo.split("@")[0] : "";

  return (
    <Panel
      title="Entra para apostar"
      subtitle={subtitulo}
      icon={KeyRound}
      action={
        <Segmented
          ariaLabel="Entrar o registrarse"
          value={modo}
          onChange={setModo}
          options={[
            { key: "entrar", label: "Entrar" },
            { key: "registrar", label: "Registrarme" },
          ]}
        />
      }
    >
      <form
        onSubmit={(evento) => {
          evento.preventDefault();

          if (registrando) {
            void envia(
              { accion: "registrar", slug: quien, correo },
              "Registrado. Ya puedes apostar",
            );
          } else {
            void envia({ accion: "entrar", correo, clave }, "Dentro");
          }
        }}
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        {registrando ? (
          <Select
            label="Quién eres"
            value={quien}
            onChange={setQuien}
            options={[
              { value: "", label: "Elige tu nombre" },
              ...STAFF.map((persona) => ({
                value: persona.slug,
                label: persona.nombre,
              })),
            ]}
          />
        ) : null}

        <Entrada
          label="Tu correo"
          type="email"
          autoComplete="email"
          value={correo}
          onChange={setCorreo}
          placeholder="nombre@dominio.com"
        />

        {!registrando && (
          <Entrada
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            value={clave}
            onChange={setClave}
          />
        )}

        <Button
          type="submit"
          tone="primary"
          disabled={
            enviando ||
            !correo.trim() ||
            (registrando ? !quien : !clave)
          }
        >
          {enviando ? "Un momento…" : registrando ? "Registrarme" : "Entrar"}
        </Button>
      </form>

      <p className="mt-3 text-[11px] leading-relaxed text-white/40">
        {registrando ? (
          <>
            Tu contraseña será lo que va antes de la @ de tu correo
            {nombreCorreo && (
              <>
                {" "}— en tu caso,{" "}
                <strong className="text-white/70">{nombreCorreo}</strong>
              </>
            )}
            . Después puedes cambiarla. Con ese correo te llegará el aviso de
            los viernes a las 9:00.
          </>
        ) : (
          <>
            ¿Primera vez? Pulsa «Registrarme». Si ya te registraste y no
            cambiaste la contraseña, es lo que va antes de la @ de tu correo.
          </>
        )}
      </p>
    </Panel>
  );
}

function CambiarClave({ manda, onCerrar }: { manda: Manda; onCerrar: () => void }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repite, setRepite] = useState("");
  const [enviando, setEnviando] = useState(false);

  const noCasan = repite.length > 0 && nueva !== repite;

  const cambia = async () => {
    setEnviando(true);

    try {
      await manda({ accion: "cambiar", actual, nueva });

      toast.success("Contraseña cambiada");
      onCerrar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se ha podido");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      title="Cambiar la contraseña"
      subtitle="La de ahora, y dos veces la nueva"
      onClose={onCerrar}
      footer={
        <>
          <Button onClick={onCerrar}>Cancelar</Button>

          <Button
            tone="primary"
            disabled={enviando || !actual || !nueva || nueva !== repite}
            onClick={() => void cambia()}
          >
            {enviando ? "Cambiando…" : "Cambiarla"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Entrada
          label="La de ahora"
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={setActual}
        />

        <Entrada
          label="La nueva"
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={setNueva}
        />

        <Entrada
          label="Otra vez la nueva"
          type="password"
          autoComplete="new-password"
          value={repite}
          onChange={setRepite}
        />

        {noCasan && (
          <p className="text-[11px] text-rose-300/80">Las dos nuevas no coinciden.</p>
        )}
      </div>
    </Dialog>
  );
}
