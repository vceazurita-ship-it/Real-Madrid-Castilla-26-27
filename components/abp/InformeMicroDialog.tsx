"use client";

/**
 * EL INFORME DE ABP DEL MICROCICLO: mirarlo y mandarlo.
 *
 * Lo arma `lib/abp/informe-micro.ts` con lo que la pantalla ya tiene cargado, y
 * aquí se hacen las dos cosas que se piden de él: **verlo sin mandar nada** —que
 * es lo normal— y mandarlo por correo desde la cuenta de Google del club.
 *
 * Dos cosas viven aquí dentro y no en la página:
 *
 * - **El seguimiento individual**, que la pantalla del microciclo no necesita
 *   para nada más. Se pide al abrir este diálogo, no al abrir la página: son
 *   138 KB que en frío tardan lo suyo, y cargarlos siempre penalizaría a quien
 *   sólo viene a planificar la semana.
 * - **A quién se le manda.** La lista se guarda en `app_documents` bajo
 *   `abp:informe-correo`, así que se escribe una vez y está para todos los
 *   microciclos y para cualquiera del cuerpo técnico.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

import { Button, Dialog, Notice, TextArea } from "@/components/abp/ui";
import { traeJson } from "@/lib/hojaCsv";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { usePlayers } from "@/hooks/usePlayers";
import { alineaSeguimiento } from "@/lib/seguimiento";

import {
  construyeInforme,
  informeHtml,
  informeTexto,
  type DatosInforme,
  type SeguimientoFila,
} from "@/lib/abp/informe-micro";

import {
  graficosDelInforme,
  type ComparativaAbp,
  type PropioAbp,
} from "@/lib/abp/informe-graficos";

import {
  leeAbpPropio,
  porJugadorAbp,
  type AccionAbp,
} from "@/lib/data-analisis/abp-propio";

/** Lo que la pantalla del microciclo ya tiene y aquí no hay que volver a pedir. */
export type DatosDelMicro = Omit<
  DatosInforme,
  "seguimientos" | "nombrePorId" | "generado" | "comparativa" | "propio" | "graficos"
>;

type AjustesCorreo = { destinatarios: string };

const VACIO: AjustesCorreo = { destinatarios: "" };

export function InformeMicroDialog({
  datos,
  onClose,
}: {
  datos: DatosDelMicro;
  onClose: () => void;
}) {
  const { value: ajustes, setValue: setAjustes } = useRemoteDoc<AjustesCorreo>({
    key: "abp:informe-correo",
    kind: "abp",
    fallback: VACIO,
  });

  const { players } = usePlayers();

  const [seguimientos, setSeguimientos] = useState<SeguimientoFila[] | null>(
    null,
  );

  /*
  | Con quién nos comparamos: la categoría de este año y nosotros mismos en las
  | temporadas anteriores, recortadas a los mismos partidos jugados. La cuenta
  | la hace el servidor (`/api/data-analisis?abpInforme=1`): el dataset de
  | Wyscout son más de dos megas y esto son cuatro kilobytes.
  */
  const [comparativa, setComparativa] = useState<ComparativaAbp | null>(null);

  const [faltaComparativa, setFaltaComparativa] = useState(false);

  /*
  | Nuestras cuatro hojas de ABP.
  |
  | Es la única fuente donde los **goles de balón parado son un dato**: el
  | analista escribe el resultado de cada acción. De la liga nadie publica de
  | qué jugada nace cada gol, así que lo que se compara con la categoría son
  | córners, faltas y remates, no goles.
  */
  const [acciones, setAcciones] = useState<AccionAbp[] | null>(null);

  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    traeJson<unknown>("/api/rivals?action=seguimiento")
      .then((data) => {
        if (cancelado) return;

        setSeguimientos(Array.isArray(data) ? (data as SeguimientoFila[]) : []);
      })
      .catch((error) => {
        console.error("[abp] seguimiento para el informe", error);

        if (!cancelado) setSeguimientos([]);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    leeAbpPropio()
      .then((datos) => {
        if (!cancelado) setAcciones(datos.acciones);
      })
      .catch((error) => {
        console.error("[abp] hojas propias para el informe", error);

        if (!cancelado) setAcciones([]);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    fetch("/api/data-analisis?abpInforme=1")
      .then((respuesta) => respuesta.json())
      .then((datos) => {
        if (cancelado) return;

        const abp = datos?.abp as ComparativaAbp | undefined;

        setComparativa(abp?.liga?.length ? abp : null);
        setFaltaComparativa(!abp?.liga?.length);
      })
      .catch((error) => {
        console.error("[abp] comparativa para el informe", error);

        if (!cancelado) setFaltaComparativa(true);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  /*
  | El nombre manda sobre el ID, como en todas las pantallas que leen esta
  | hoja: los `JUG-XX` se han renumerado y un registro viejo apunta hoy a otra
  | persona. Ver `lib/seguimiento.ts`.
  */
  const filasSeguimiento = useMemo(() => {
    if (!seguimientos) return [];

    return alineaSeguimiento(
      seguimientos.map((fila) => ({
        ...fila,
        ID_JUGADOR: String(fila.ID_JUGADOR ?? ""),
      })),
      players,
    );
  }, [seguimientos, players]);

  const nombrePorId = useMemo(
    () => new Map(players.map((jugador) => [jugador.id, jugador.nombre])),
    [players],
  );

  /**
   * Nuestro balón parado, resumido para el informe.
   *
   * Se agrupa aquí y no en la librería porque es una lectura de nuestras hojas
   * y sólo la necesita este diálogo. El orden de las jornadas es el de
   * `porJornadaAbp`: la pretemporada, que es de julio, va delante.
   */
  const propio = useMemo<PropioAbp | null>(() => {
    if (!acciones) return null;

    const ofensivas = acciones.filter((una) => una.bloque.endsWith("Of"));
    const defensivas = acciones.filter((una) => una.bloque.endsWith("Def"));

    const resume = (lista: AccionAbp[]) => ({
      acciones: lista.length,
      remates: lista.filter((una) => una.remate).length,
      goles: lista.filter((una) => una.gol).length,
      peligros: lista.filter((una) => una.peligro).length,
      xg: Number(lista.reduce((suma, una) => suma + una.xg, 0).toFixed(2)),
    });

    const todo = resume(acciones);

    /* Por familia de acción: córner, falta, banda… */
    const porFamilia = new Map<string, AccionAbp[]>();

    acciones.forEach((una) => {
      const clave = `${una.familia}${una.bloque.endsWith("Def") ? " (en contra)" : ""}`;

      porFamilia.set(clave, [...(porFamilia.get(clave) ?? []), una]);
    });

    const porAspecto = [...porFamilia.entries()]
      .map(([etiqueta, lista]) => ({
        etiqueta,
        acciones: lista.length,
        peligro: lista.length
          ? (lista.filter((una) => una.peligro).length / lista.length) * 100
          : 0,
        goles: lista.filter((una) => una.gol).length,
      }))
      .sort((a, b) => b.acciones - a.acciones);

    /* Por jornada, en orden de calendario y con la pretemporada delante. */
    const porClave = new Map<string, AccionAbp[]>();

    acciones.forEach((una) => {
      porClave.set(una.jornada.clave, [
        ...(porClave.get(una.jornada.clave) ?? []),
        una,
      ]);
    });

    const porJornada = [...porClave.values()]
      .sort((a, b) => {
        const bloque = (lista: AccionAbp[]) =>
          lista[0].jornada.competicion === "amistoso" ? 0 : 1;

        if (bloque(a) !== bloque(b)) return bloque(a) - bloque(b);

        return (a[0].jornada.numero ?? 0) - (b[0].jornada.numero ?? 0);
      })
      .map((lista) => ({
        etiqueta: lista[0].jornada.corto,
        acciones: lista.length,
        peligro: lista.length
          ? (lista.filter((una) => una.peligro).length / lista.length) * 100
          : 0,
        goles: lista.filter((una) => una.gol).length,
        nota: `${lista[0].jornada.etiqueta} · ${lista[0].rival ?? ""}`,
      }));

    return {
      partidos: porClave.size,
      ...todo,
      cuotaRemate: todo.acciones ? (todo.remates / todo.acciones) * 100 : 0,
      cuotaPeligro: todo.acciones ? (todo.peligros / todo.acciones) * 100 : 0,
      ofensivo: resume(ofensivas),
      defensivo: resume(defensivas),
      porAspecto,
      porJornada,
      /* Los nombres sólo valen en lo nuestro: en las hojas defensivas el que
         remata es del rival. */
      rematadores: porJugadorAbp(ofensivas, (una) => una.rematador).map(
        (uno) => ({ jugador: uno.jugador, total: uno.total, peligro: uno.peligro }),
      ),
      sacadores: porJugadorAbp(ofensivas, (una) => una.sacador).map((uno) => ({
        jugador: uno.jugador,
        total: uno.total,
        peligro: uno.peligro,
      })),
    };
  }, [acciones]);

  /*
  | El informe se arma DOS VECES, y no es un descuido.
  |
  | Los gráficos necesitan cosas que sólo salen de armarlo —el objetivo de
  | minutos prorrateado, el reparto de la semana, las tareas valoradas y el
  | seguimiento ya agrupado—, así que primero se monta sin dibujos, con eso se
  | pintan, y se vuelve a montar con ellos dentro. Montarlo es contar y
  | ordenar listas: lo que cuesta es dibujar, y eso se hace una sola vez.
  */
  const borrador = useMemo(
    () =>
      construyeInforme({
        ...datos,
        seguimientos: filasSeguimiento,
        nombrePorId,
        comparativa,
        propio,
      }),
    [datos, filasSeguimiento, nombrePorId, comparativa, propio],
  );

  /* Los gráficos se dibujan en un lienzo y salen en PNG: un correo no ejecuta
     nada, así que lo único que sobrevive es una imagen. */
  const graficos = useMemo(
    () =>
      graficosDelInforme({
        comparativa,
        propio,
        tiempo: borrador.tiempo,
        tareasValoradas: borrador.tareasValoradas,
        seguimiento: borrador.seguimientoResumen,
        mediaValoracion: borrador.valoracion.media,
      }),
    [comparativa, propio, borrador],
  );

  const informe = useMemo(
    () => ({ ...borrador, graficos }),
    [borrador, graficos],
  );

  const html = useMemo(() => informeHtml(informe), [informe]);

  const cargandoSeguimiento = seguimientos === null;

  const cargandoComparativa = comparativa === null && !faltaComparativa;

  const cargandoPropio = acciones === null;

  const envia = async () => {
    if (enviando) return;

    const para = ajustes.destinatarios.trim();

    if (!para) {
      toast.error("Escribe al menos una dirección de correo.");
      return;
    }

    setEnviando(true);

    try {
      const respuesta = await fetch("/api/abp/informe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          para,
          asunto: informe.asunto,
          /* En el correo las imágenes no van dentro del HTML: se llaman por su
             `cid` y viajan como partes aparte, que es lo único que Gmail pinta. */
          html: informeHtml(informe, { imagenes: "cid" }),
          texto: informeTexto(informe),
          imagenes: graficos.map((grafico) => ({
            cid: grafico.cid,
            base64: grafico.imagen.replace(/^data:image\/png;base64,/, ""),
          })),
        }),
      });

      const datosRespuesta = (await respuesta.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        cuenta?: string;
        para?: string[];
      } | null;

      if (!respuesta.ok || !datosRespuesta?.ok) {
        throw new Error(datosRespuesta?.error ?? "No se ha podido enviar.");
      }

      const cuantos = datosRespuesta.para?.length ?? 0;

      toast.success(
        `Informe enviado a ${cuantos} dirección${cuantos === 1 ? "" : "es"}`,
        {
          description: datosRespuesta.cuenta
            ? `Desde ${datosRespuesta.cuenta}`
            : undefined,
        },
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se ha podido enviar.",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      title={informe.titulo}
      subtitle={[informe.subtitulo, informe.rango].filter(Boolean).join(" · ")}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-[11px] text-white/35">
            Sale de la cuenta de Google del club, la misma que sube los vídeos
            al canal.
          </p>

          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={onClose}>Cerrar</Button>

            <Button
              tone="primary"
              icon={enviando ? Loader2 : Send}
              onClick={() => void envia()}
              disabled={
                enviando ||
                cargandoSeguimiento ||
                cargandoComparativa ||
                cargandoPropio
              }
            >
              {enviando ? "Enviando…" : "Enviar por correo"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <TextArea
          label="A quién se le manda"
          value={ajustes.destinatarios}
          onChange={(destinatarios) => setAjustes({ destinatarios })}
          placeholder="correo@ejemplo.com, otro@ejemplo.com"
          rows={2}
        />

        <p className="text-[11px] leading-relaxed text-white/35">
          Separadas por comas, por punto y coma o una por línea. Se guardan solas
          y valen para todos los microciclos.
        </p>

        {cargandoSeguimiento || cargandoComparativa || cargandoPropio ? (
          <p className="flex items-center gap-2 text-xs text-white/45">
            <RefreshCw size={13} className="animate-spin" />
            {cargandoSeguimiento
              ? "Cargando el seguimiento individual…"
              : cargandoPropio
                ? "Cargando nuestras hojas de balón parado…"
                : "Cargando la comparación con la categoría…"}
          </p>
        ) : (
          informe.avisos.length > 0 && (
            <Notice tone="warn" title="Lo que este informe no sabe">
              <ul className="ml-4 list-disc space-y-1">
                {informe.avisos.map((aviso) => (
                  <li key={aviso}>{aviso}</li>
                ))}
              </ul>
            </Notice>
          )
        )}

        {/*
          La vista previa es el correo de verdad, no una maqueta: se pinta el
          mismo HTML que se manda, en un marco aislado para que sus estilos no
          se mezclen con los de la app.
        */}
        <div className="overflow-hidden rounded-xl border border-white/10">
          <iframe
            title="Vista previa del informe"
            srcDoc={html}
            className="h-[58vh] w-full bg-white"
          />
        </div>
      </div>
    </Dialog>
  );
}

export { Mail as IconoInforme };
