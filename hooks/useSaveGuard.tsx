"use client";

/*
|--------------------------------------------------------------------------
| useSaveGuard
|--------------------------------------------------------------------------
|
| Red de seguridad común a todos los guardados de la app.
|
| El problema que resuelve: las escrituras acaban en una hoja de cálculo que
| solo conserva los campos con cabecera propia. Lo demás se descarta y la
| respuesta sigue siendo `success: true`, así que la pantalla dice "guardado",
| el formulario se cierra y el texto desaparece en la siguiente recarga.
|
| Uso desde una página:
|
|     const guardado = useSaveGuard();
|
|     const resultado = await guardado.verificar({
|       titulo: `Plan de partido · ${rival.EQUIPO}`,
|       enviado: rival,
|       releer: async () => buscarRivalEnServidor(rival.ID),
|     });
|
|     if (!resultado.ok) return;   // aviso abierto: no cierres la edición
|
| Y en el JSX: `{guardado.dialogo}`.
|
| Mientras el aviso está abierto se bloquea el `beforeunload` del navegador,
| porque en ese momento la pantalla es la única copia que queda.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  CampoPerdido,
  compararGuardado,
  marcarComoRechazados,
  resumirPerdida,
} from "@/lib/save-guard/verificar";
import { SaveGuardDialog } from "@/components/save-guard/SaveGuardDialog";

export interface OpcionesVerificacion<T extends Record<string, unknown>> {
  /** Encabeza el aviso y da nombre al archivo exportado. */
  titulo: string;
  /** Lo que se acaba de mandar al servidor. */
  enviado: T;
  /**
   * Relee el registro del servidor. Devolver `null` significa "no he podido
   * comprobarlo", que no es lo mismo que "se ha perdido".
   */
  releer: () => Promise<Record<string, unknown> | null>;
  /** Campos que el servidor reescribe de forma legítima. */
  ignorar?: readonly string[];
  /**
   * Comprueba solo que existan las columnas, no su contenido. Para relecturas
   * que vienen de un CSV publicado, que Google sirve cacheado.
   */
  soloColumnas?: boolean;
  /**
   * Registro completo a exportar. Por defecto, lo enviado; se pasa aparte
   * cuando en pantalla hay más contexto del que viaja en el guardado.
   */
  registro?: Record<string, unknown>;
  /**
   * Verificación de un autoguardado.
   *
   * Con autoguardado la misma comprobación se repite cada pocos segundos. Si
   * la hoja no tiene una columna, no la va a tener en el intento siguiente:
   * abrir el aviso a pantalla completa cada vez haría la página inusable y,
   * peor, enseñaría a cerrarlo sin leerlo.
   *
   * En este modo el aviso se abre **la primera vez** que aparece una columna
   * perdida nueva. Mientras sigan siendo las mismas, la pérdida se mantiene
   * viva en `columnasPerdidas` para que la página la enseñe fija en la
   * cabecera, pero no se vuelve a interrumpir.
   */
  modoAuto?: boolean;
}

export type ResultadoVerificacion =
  | { ok: true; verificado: boolean }
  | { ok: false; perdidos: CampoPerdido[] };

interface EstadoAviso {
  titulo: string;
  perdidos: CampoPerdido[];
  registro: Record<string, unknown>;
}

export function useSaveGuard() {
  const [aviso, setAviso] = useState<EstadoAviso | null>(null);

  /*
  | Columnas que ya sabemos que la hoja no acepta, para el modo autoguardado.
  | Se conservan mientras dure la pantalla: la página las enseña fijas y el
  | aviso a pantalla completa solo vuelve a salir si aparece alguna nueva.
  */
  const [columnasPerdidas, setColumnasPerdidas] = useState<string[]>([]);
  const yaReportadas = useRef<Set<string>>(new Set());

  /* Con el aviso abierto, la pantalla es la única copia del trabajo. */
  useEffect(() => {
    if (!aviso) return;

    const avisarAlSalir = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();

      /* Los navegadores modernos ignoran el texto, pero exigen returnValue. */
      evento.returnValue = "";
    };

    window.addEventListener("beforeunload", avisarAlSalir);

    return () => window.removeEventListener("beforeunload", avisarAlSalir);
  }, [aviso]);

  const verificar = useCallback(
    async <T extends Record<string, unknown>>({
      titulo,
      enviado,
      releer,
      ignorar,
      soloColumnas,
      registro,
      modoAuto,
    }: OpcionesVerificacion<T>): Promise<ResultadoVerificacion> => {
      let guardadoEnServidor: Record<string, unknown> | null = null;

      try {
        guardadoEnServidor = await releer();
      } catch (error) {
        console.error("[save-guard] no se pudo releer el registro", error);

        guardadoEnServidor = null;
      }

      /* Sin relectura no acusamos al servidor, pero tampoco damos por bueno
         el guardado en silencio: se dice claramente que no está comprobado. */
      if (!guardadoEnServidor) {
        /* En autoguardado esto pasa con cualquier corte de red pasajero y el
           siguiente intento lo resolverá solo: no se interrumpe por ello. */
        if (!modoAuto) {
          toast.warning("Guardado sin verificar", {
            description:
              "No se ha podido releer el registro. Revisa que el contenido siga ahí antes de cerrar.",
          });
        }

        return { ok: true, verificado: false };
      }

      const perdidos = compararGuardado(enviado, guardadoEnServidor, {
        ignorar,
        soloColumnas,
      });

      if (!perdidos.length) return { ok: true, verificado: true };

      if (modoAuto) {
        const nuevas = perdidos
          .map((perdido) => perdido.campo)
          .filter((campo) => !yaReportadas.current.has(campo));

        perdidos.forEach((perdido) => yaReportadas.current.add(perdido.campo));

        setColumnasPerdidas([...yaReportadas.current].sort());

        /* Nada nuevo: la página ya lo está enseñando en la cabecera. */
        if (!nuevas.length) return { ok: false, perdidos };
      }

      setAviso({
        titulo,
        perdidos,
        registro: registro ?? enviado,
      });

      toast.error(resumirPerdida(perdidos), {
        description: "Exporta el contenido antes de cerrar la página.",
      });

      return { ok: false, perdidos };
    },
    []
  );

  /**
   * Abre el aviso sin relectura previa, para cambios que ya sabemos que el
   * servidor no ha aceptado (guardados por lotes con respuestas de error).
   */
  const reportarRechazo = useCallback(
    (opciones: {
      titulo: string;
      /** Etiqueta legible -> texto que se queda sin guardar. */
      campos: Record<string, string>;
      registro?: Record<string, unknown>;
    }) => {
      const perdidos = marcarComoRechazados(opciones.campos);

      if (!perdidos.length) return;

      setAviso({
        titulo: opciones.titulo,
        perdidos,
        registro: opciones.registro ?? opciones.campos,
      });

      toast.error(resumirPerdida(perdidos), {
        description: "Exporta el contenido antes de cerrar la página.",
      });
    },
    []
  );

  const cerrarAviso = useCallback(() => setAviso(null), []);

  const dialogo = aviso ? (
    <SaveGuardDialog
      titulo={aviso.titulo}
      perdidos={aviso.perdidos}
      registro={aviso.registro}
      onSeguirEditando={cerrarAviso}
    />
  ) : null;

  return {
    verificar,
    reportarRechazo,
    dialogo,
    avisoAbierto: aviso !== null,
    /** Columnas que la hoja ha rechazado durante esta sesión (modo auto). */
    columnasPerdidas,
  };
}
