"use client";

/**
 * La pizarra de ABP del partido, fotografiada para el informe (25/10/2026).
 *
 * El informe de balón parado —previa y post— lleva las diapositivas de
 * `/abp-pizarra` de esa jornada como un gráfico más (área `pizarra`): así
 * entran solas en la vista previa, en el correo (por `cid`) y en el PDF, que
 * sale del mismo HTML.
 *
 * La pizarra no es una imagen guardada sino un documento (`abp-pizarra`), así
 * que aquí se lee, se monta fuera de pantalla con el mismo `TableroSlide` que
 * exporta el PowerPoint y se fotografía con la misma maquinaria
 * (`lib/export/lienzos.ts`). Sólo se LEE el documento: nada de `useRemoteDoc`,
 * que guarda.
 *
 * Cada tablero se guarda con la clave de su fila de la hoja RIVALES
 * (`riv-RIV-09`), y ese número es la jornada. Se busca por rival y, si hay
 * dos —ida y vuelta—, manda la jornada.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import type { Player } from "@/types/player";
import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import {
  COLORES,
  TABLERO_H,
  TABLERO_W,
  normalizaTablero,
  tituloVisible,
  type PizarraStore,
  type TableroPizarra,
} from "@/lib/abp/pizarra";
import type { GraficoInforme } from "@/lib/abp/informe-graficos";
import { mismoRival } from "@/lib/abp/informe-micro";
import { notasDeDiapositiva } from "@/lib/abp/laminas-lectura";
import { capturaLienzos, esperaFotos, pintado } from "@/lib/export/lienzos";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";
import { RATINGS_SEASON } from "@/lib/ratings/types";
import { idsDelOnce, onceDeLaPizarra, type OnceDeLaPizarra } from "@/lib/tactics/onceDeLaPizarra";

/* 960 px de ancho: se lee de sobra en un correo (que se ve a 760) y nueve
   diapositivas no se comen el tope del correo. */
const NITIDEZ = 0.5;

function temporadaCorta(season: string) {
  const [desde, hasta] = season.split("-");

  return `${desde?.slice(2) ?? ""} / ${hasta?.slice(2) ?? ""}`;
}

/** La jornada que lleva la clave del tablero: `riv-RIV-09` → 9. */
function jornadaDeClave(clave: string): number | null {
  const encontrado = /RIV-0*(\d+)$/i.exec(clave);

  return encontrado ? Number(encontrado[1]) : null;
}

export function tableroDelPartido(
  store: PizarraStore | null,
  rival: string,
  jornada: number | null,
): TableroPizarra | null {
  if (!store?.tableros || !rival) return null;

  const suyos = Object.entries(store.tableros).filter(
    ([, tablero]) => tablero.slides?.length && mismoRival(tablero.rival || "", rival),
  );

  if (suyos.length === 0) return null;

  const deLaJornada =
    jornada != null
      ? suyos.find(([clave, tablero]) => (jornadaDeClave(clave) ?? Number(tablero.jornada)) === jornada)
      : undefined;

  if (deLaJornada) return deLaJornada[1];

  /* Sin jornada que case, el último que se tocó. */
  return suyos.sort(([, a], [, b]) => (b.actualizado ?? "").localeCompare(a.actualizado ?? ""))[0][1];
}

export type PizarraInformeEstado = {
  cargando: boolean;
  graficos: GraficoInforme[];
  /**
   * La pizarra del partido y nuestro once, leídos para «Para hoy»
   * (`pizarraParaInforme`, 31/10/2026): sin las alturas de Wyscout, que las
   * pone quien llama.
   */
  tablero: TableroPizarra | null;
  /** Ids de la plantilla del once de la pizarra táctica; vacío si no hay siete casados. */
  onceIds: string[];
  /** Las alturas escritas a mano en «Quién marca a quién» (cm por id). */
  alturas: Record<string, number>;
};

/**
 * Lee la pizarra, la fotografía y devuelve las diapositivas como gráficos.
 * El `deck` hay que pintarlo en algún sitio del árbol: es el tablero que se
 * fotografía, fuera de pantalla.
 */
export function usePizarraInforme(
  rival: string,
  jornada: number | null,
  players: Player[],
): PizarraInformeEstado & { deck: React.ReactNode } {
  const [store, setStore] = useState<PizarraStore | null>(null);
  const [leido, setLeido] = useState(false);
  const [graficos, setGraficos] = useState<GraficoInforme[]>([]);
  const [hecho, setHecho] = useState("");

  const deckRef = useRef<HTMLDivElement>(null);

  /* Nuestro once (pizarra táctica) y las alturas escritas a mano: sólo se leen. */
  const [once, setOnce] = useState<OnceDeLaPizarra | null>(null);
  const [alturas, setAlturas] = useState<Record<string, number>>({});

  useEffect(() => {
    let vivo = true;

    const pizarra = fetch("/api/docs?key=abp-pizarra", { cache: "no-store" })
      .then((respuesta) => respuesta.json())
      .then((json) => {
        if (vivo) setStore((json?.data as PizarraStore) ?? null);
      })
      .catch(() => undefined);

    const delOnce = onceDeLaPizarra()
      .then((o) => {
        if (vivo) setOnce(o);
      })
      .catch(() => undefined);

    const deAlturas = fetch("/api/docs?key=abp%3Aalturas-nuestros", { cache: "no-store" })
      .then((respuesta) => respuesta.json())
      .then((json) => {
        const data = json?.data;

        if (vivo && data && typeof data === "object") setAlturas(data as Record<string, number>);
      })
      .catch(() => undefined);

    void Promise.all([pizarra, delOnce, deAlturas]).finally(() => {
      if (vivo) setLeido(true);
    });

    return () => {
      vivo = false;
    };
  }, []);

  /* Como en /abp-pizarra: con menos de siete casados, no hay once que valga. */
  const onceIds = useMemo(() => {
    const ids = once ? idsDelOnce(once, players) : [];

    return ids.length >= 7 ? ids : [];
  }, [once, players]);

  const tablero = useMemo(() => {
    const encontrado = tableroDelPartido(store, rival, jornada);

    return encontrado ? normalizaTablero(encontrado) : null;
  }, [store, rival, jornada]);

  const porId = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  /* Lo que identifica lo fotografiado: si no cambia, no se repite. */
  const huella = tablero && players.length ? `${tablero.partidoId}|${tablero.actualizado ?? ""}|${tablero.slides.length}|${players.length}` : "";

  useEffect(() => {
    if (!huella || huella === hecho || !tablero) return;

    let vivo = true;

    const id = window.setTimeout(async () => {
      const raiz = deckRef.current;

      if (!raiz) return;

      try {
        await pintado();
        await esperaFuentePortada();
        await esperaFotos(raiz);

        const imagenes = await capturaLienzos(raiz, "[data-abp-tablero]", {
          ancho: TABLERO_W,
          alto: TABLERO_H,
          fondo: COLORES.tinta,
          nitidez: NITIDEZ,
        });

        if (!vivo) return;

        const rotulo = tablero.rival || rival;

        /* Los nombres de la plantilla, para escribirlos con mayúscula; y cada consigna, una vez en toda la pizarra. */
        const nombres = [...porId.values()].flatMap((p) => [p.nombre, p.apodo ?? ""]).filter(Boolean);

        const yaDichas = new Set<string>();

        setGraficos(
          imagenes.map((imagen, indice) => ({
            cid: `pizarra-${indice + 1}`,
            titulo: `${indice + 1}. ${tituloVisible(tablero.slides, indice)}`,
            area: "pizarra",
            /*
            | Las consignas de la diapositiva, en texto (31/10/2026, equipo de
            | expertos): quién saca, quién bloquea, adónde va el balón. Dentro
            | de la imagen no se leen en el móvil y no viajan en el texto plano.
            */
            leyenda: notasDeDiapositiva(tablero.slides[indice]?.notas, nombres, yaDichas) || `Pizarra de balón parado · ${rotulo}`,
            imagen,
            ancho: 760,
          })),
        );
      } catch (error) {
        console.error("[informe ABP] pizarra", error);

        if (vivo) setGraficos([]);
      } finally {
        if (vivo) setHecho(huella);
      }
    }, 120);

    return () => {
      vivo = false;
      window.clearTimeout(id);
    };
  }, [huella, hecho, tablero, rival, porId]);

  const cargando = !leido || (!!huella && huella !== hecho);

  const deck =
    tablero && huella && huella !== hecho ? (
      <div
        ref={deckRef}
        aria-hidden
        data-export-hide
        className="pointer-events-none"
        style={{ position: "fixed", top: 0, left: -(TABLERO_W + 200), width: TABLERO_W, zIndex: -1 }}
      >
        {tablero.slides.map((slide, indice) => (
          <div key={slide.id} style={{ width: TABLERO_W }}>
            <TableroSlide
              slide={slide}
              titulo={tituloVisible(tablero.slides, indice)}
              soloVer
              players={porId}
              temporada={temporadaCorta(RATINGS_SEASON)}
              rival={tablero.rival || rival}
              seleccion={null}
              onMover={() => undefined}
              onQuitar={() => undefined}
              onPulsarPuesto={() => undefined}
              onSeleccionar={() => undefined}
            />
          </div>
        ))}
      </div>
    ) : null;

  return { cargando, graficos: tablero ? graficos : [], deck, tablero, onceIds, alturas };
}
