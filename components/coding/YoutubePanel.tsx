"use client";

/**
 * CODING · la cuenta de YouTube.
 *
 * Un vídeo unificado se descarga siempre al ordenador, pero además puede
 * subirse al canal del club: es lo que se manda por WhatsApp al jugador, y un
 * enlace pesa lo mismo que un mensaje. Por defecto sube **en oculto** —con el
 * enlace se ve, buscando no aparece— y a la lista de reproducción que se elija
 * aquí, para que cada partido quede ordenado sin tener que entrar en YouTube.
 *
 * Todo lo que se decide en este panel se guarda en el servidor, no en la
 * pestaña: el analista que exporta el martes desde otro portátil se encuentra
 * la misma cuenta y la misma lista.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Link2,
  LogOut,
  RefreshCw,
  /* lucide ya no trae marcas: el cuadro con el «play» es el icono de YouTube. */
  SquarePlay as Youtube,
} from "lucide-react";
import { toast } from "sonner";

import { Button, Notice, Panel, Segmented, Select } from "@/components/abp/ui";
import { NOMBRE_PRIVACIDAD } from "@/lib/coding/youtube-cliente";

export type PrivacidadYoutube = keyof typeof NOMBRE_PRIVACIDAD;

export type EstadoYoutube = {
  configurado: boolean;
  conectado: boolean;
  canalTitulo: string;
  privacidad: PrivacidadYoutube;
  listaId: string;
  listaNombre: string;
  subeSiempre: boolean;
  conectadoEn: string;
  listas: { id: string; nombre: string; cuenta: number }[];
  aviso?: string;
};

const VACIO: EstadoYoutube = {
  configurado: false,
  conectado: false,
  canalTitulo: "",
  privacidad: "unlisted",
  listaId: "",
  listaNombre: "",
  subeSiempre: true,
  conectadoEn: "",
  listas: [],
};

/**
 * El estado de la cuenta, para la pantalla del coding.
 *
 * Lo usan dos sitios —este panel y la barra de exportación— así que vive en un
 * hook y no dentro del panel: la barra tiene que saber si va a subir antes de
 * que nadie despliegue nada.
 */
export function useYoutube() {
  const [estado, setEstado] = useState<EstadoYoutube>(VACIO);
  const [cargando, setCargando] = useState(true);

  /** La URL que hay que dar de alta en la consola de Google. */
  const [vuelta, setVuelta] = useState("");

  /*
  | Volver a leer se pide con un contador, no llamando a una función.
  |
  | La carga vive **dentro** del efecto a propósito: `react-hooks/purity` no
  | deja llamar desde un efecto a una función de fuera que ponga estado —es
  | una cascada de renders—, y la forma que sí pasa es ésta, la misma que usa
  | `useRemoteDoc`. Quien quiera recargar sube el contador; el efecto se
  | vuelve a montar solo.
  */
  const [vuelve, setVuelve] = useState(0);

  useEffect(() => {
    let vivo = true;

    const carga = async () => {
      try {
        const respuesta = await fetch("/api/youtube", { cache: "no-store" });

        const datos = (await respuesta.json()) as {
          ok?: boolean;
          estado?: EstadoYoutube;
          vuelta?: string;
        };

        if (!vivo) return;

        if (datos.ok && datos.estado) {
          setEstado(datos.estado);
          setVuelta(datos.vuelta ?? "");
        }
      } catch (error) {
        console.warn("[youtube] no se ha podido leer la cuenta", error);
      } finally {
        if (vivo) setCargando(false);
      }
    };

    void carga();

    return () => {
      vivo = false;
    };
  }, [vuelve]);

  /** Volver a leer el canal y sus listas. Sale de un clic, no de un efecto. */
  const recarga = useCallback(() => {
    setCargando(true);
    setVuelve((valor) => valor + 1);
  }, []);

  /*
  | Guardar es optimista a propósito.
  |
  | Cambiar la lista de reproducción o la privacidad tiene que verse en el
  | acto: esperar a que conteste el servidor para mover un desplegable hace que
  | parezca que el clic no ha entrado, y quien lo pulsa dos veces acaba
  | dejándolo como estaba.
  */
  const guarda = useCallback(async (cambios: Partial<EstadoYoutube>) => {
    setEstado((actual) => ({ ...actual, ...cambios }));

    try {
      const respuesta = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "ajustes", ...cambios }),
      });

      const datos = (await respuesta.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!datos?.ok) throw new Error(datos?.error ?? "No se ha podido guardar.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se han podido guardar los ajustes.",
      );

      recarga();
    }
  }, [recarga]);

  const desconecta = useCallback(async () => {
    await fetch("/api/youtube", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "desconectar" }),
    });

    toast.success("Cuenta de YouTube desconectada");

    recarga();
  }, [recarga]);

  return { estado, cargando, vuelta, recarga, guarda, desconecta };
}

/**
 * El aviso de la vuelta de Google.
 *
 * El callback termina en `/coding?youtube=…` porque dejar al analista en una
 * pestaña con un JSON en crudo no es terminar nada. Aquí se traduce.
 */
export const AVISOS_YOUTUBE: Record<string, { tono: "ok" | "mal"; texto: string; detalle?: string }> = {
  ok: { tono: "ok", texto: "Cuenta de YouTube conectada" },
  cancelado: { tono: "mal", texto: "No se ha conectado: se canceló en Google" },
  "sin-credenciales": {
    tono: "mal",
    texto: "Falta configurar la aplicación de Google",
    detalle: "YOUTUBE_CLIENT_ID y YOUTUBE_CLIENT_SECRET no están en el servidor.",
  },
  "sin-codigo": { tono: "mal", texto: "Google no ha devuelto el permiso" },
  state: {
    tono: "mal",
    texto: "La vuelta de Google no cuadra",
    detalle: "Vuelve a darle a «Conectar» desde esta pantalla.",
  },
  token: {
    tono: "mal",
    texto: "Google no ha dado el token",
    detalle: "Suele ser la URL de vuelta: tiene que estar dada de alta tal cual en la consola.",
  },
  "sin-refresco": {
    tono: "mal",
    texto: "Google no ha dado permiso permanente",
    detalle:
      "Quita el acceso de la app en tu cuenta de Google y vuelve a conectar, " +
      "para que salga otra vez la pantalla de consentimiento.",
  },
  fallo: { tono: "mal", texto: "No se ha podido conectar la cuenta" },
};

export function PanelYoutube({
  estado,
  cargando,
  vuelta,
  onRecarga,
  onGuarda,
  onDesconecta,
}: {
  estado: EstadoYoutube;
  cargando: boolean;
  vuelta: string;
  onRecarga: () => void;
  onGuarda: (cambios: Partial<EstadoYoutube>) => void;
  onDesconecta: () => void;
}) {
  return (
    <Panel
      title="YouTube"
      subtitle={
        estado.conectado
          ? `${estado.canalTitulo} · sube en ${NOMBRE_PRIVACIDAD[estado.privacidad]}`
          : "Subir los vídeos montados al canal del club"
      }
      icon={Youtube}
      action={
        estado.conectado ? (
          <Button icon={RefreshCw} onClick={onRecarga} title="Volver a leer el canal y sus listas">
            {cargando ? "…" : "Actualizar"}
          </Button>
        ) : undefined
      }
      bodyClassName="space-y-3 p-3 sm:p-3"
    >
      {/* ------------------------------- sin credenciales ------------- */}

      {!estado.configurado && (
        <Notice tone="warn" title="Falta dar de alta la aplicación en Google">
          <p>
            Esto se hace una vez. En la consola de Google Cloud: crea un
            proyecto, activa la <b className="text-white/70">YouTube Data API v3</b> y
            haz unas credenciales de tipo{" "}
            <b className="text-white/70">ID de cliente de OAuth · aplicación web</b>.
          </p>

          {vuelta && (
            <p className="mt-2">
              Como URI de redirección autorizado, éste tal cual:
              <br />
              <code className="mt-1 inline-block break-all rounded-md bg-black/40 px-1.5 py-1 text-[11px] text-[#C8A96B]">
                {vuelta}
              </code>
            </p>
          )}

          <p className="mt-2">
            Luego pon el identificador y el secreto en el fichero{" "}
            <code className="text-white/70">.env.local</code> como{" "}
            <code className="text-white/70">YOUTUBE_CLIENT_ID</code> y{" "}
            <code className="text-white/70">YOUTUBE_CLIENT_SECRET</code>, y reinicia la app.
          </p>
        </Notice>
      )}

      {/* ---------------------------------- sin conectar -------------- */}

      {estado.configurado && !estado.conectado && (
        <>
          {estado.aviso && (
            <Notice tone="warn" title="La cuenta ya no responde">
              <p>{estado.aviso}</p>
            </Notice>
          )}

          <p className="text-[11px] leading-relaxed text-white/40">
            Conecta la cuenta de Google que tenga el canal donde van los vídeos.
            Se pide permiso para <b className="text-white/60">subir vídeos</b> y para{" "}
            <b className="text-white/60">ordenarlos en una lista</b>, nada más.
          </p>

          <a
            href="/api/youtube/conectar"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#C8A96B] bg-[#C8A96B] px-3 py-2 text-xs font-semibold text-black transition hover:bg-[#d8bc82]"
          >
            <Link2 size={14} />
            Conectar cuenta de YouTube
          </a>
        </>
      )}

      {/* ----------------------------------- conectada ---------------- */}

      {estado.conectado && (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-2.5 py-2">
            <Check size={14} className="text-emerald-400" />

            <span className="min-w-0 truncate text-xs text-white/80">
              {estado.canalTitulo}
            </span>

            <span className="ml-auto">
              <Button icon={LogOut} tone="danger" onClick={onDesconecta}>
                Desconectar
              </Button>
            </span>
          </div>

          <div className="space-y-1.5">
            <span className="block text-[10px] uppercase tracking-[0.16em] text-white/40">
              Quién puede verlo
            </span>

            <Segmented
              ariaLabel="Privacidad del vídeo subido"
              value={estado.privacidad}
              onChange={(privacidad) => onGuarda({ privacidad })}
              options={[
                { key: "unlisted" as const, label: "Oculto" },
                { key: "private" as const, label: "Privado" },
                { key: "public" as const, label: "Público" },
              ]}
            />

            <p className="text-[11px] leading-relaxed text-white/35">
              {estado.privacidad === "unlisted"
                ? "Con el enlace se ve; buscando en YouTube no aparece. Es lo que se manda al jugador."
                : estado.privacidad === "private"
                  ? "Sólo lo ve la cuenta del canal: ni con el enlace lo abre nadie más."
                  : "Sale en el canal del club y en las búsquedas. Cuidado con el análisis individual."}
            </p>
          </div>

          <Select
            label="Lista de reproducción"
            value={estado.listaId}
            onChange={(listaId) =>
              onGuarda({
                listaId,
                listaNombre:
                  estado.listas.find((lista) => lista.id === listaId)?.nombre ?? "",
              })
            }
            options={[
              { value: "", label: "Ninguna: se queda suelto en el canal" },
              ...estado.listas.map((lista) => ({
                value: lista.id,
                label: `${lista.nombre} (${lista.cuenta})`,
              })),
            ]}
          />

          {estado.listas.length === 0 && (
            <p className="text-[11px] text-white/35">
              Este canal no tiene ninguna lista todavía. Créala en YouTube y dale a
              «Actualizar».
            </p>
          )}

          <button
            type="button"
            onClick={() => onGuarda({ subeSiempre: !estado.subeSiempre })}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
              estado.subeSiempre
                ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                : "border-white/10 text-white/40 hover:text-white"
            }`}
          >
            <Youtube size={12} />
            {estado.subeSiempre ? "Sube al exportar" : "No sube solo"}
          </button>

          <p className="text-[11px] leading-relaxed text-white/35">
            {estado.subeSiempre
              ? "Se descarga y además se sube: tanto el vídeo unificado como un corte suelto. El ZIP no."
              : "Los vídeos sólo se descargan. Se vuelve a activar aquí o en la barra de exportación."}
          </p>
        </>
      )}
    </Panel>
  );
}
