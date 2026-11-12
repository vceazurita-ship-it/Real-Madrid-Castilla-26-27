"use client";

/**
 * La mesa de trabajo de los PDF por jugador (27/10/2026): monta fuera de
 * pantalla las diapositivas que salen en algún PDF, las fotografía UNA vez y
 * arma el PDF de cada uno encima de esas fotos.
 *
 * Antes se montaba y fotografiaba el tablero de cada jugador con su cara
 * resaltada: once jugadores eran once tandas de fotos de las mismas
 * diapositivas. Ahora el resalte (foco y aro «TÚ») se pinta en el lienzo del
 * PDF, y la foto se comparte: el tiempo es el de una sola tanda.
 *
 * Vive en el layout (vía `TrabajoPdfs`): sigue aunque se cambie de pantalla.
 */

import { useEffect, useMemo, useRef } from "react";

import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import { COLORES, TABLERO_H, TABLERO_W, tituloVisible } from "@/lib/abp/pizarra";
import { aJornada, type FilaRival } from "@/lib/abp/jornada";
import { cargaCalendario } from "@/hooks/useCalendario";
import {
  cargaEscudos,
  cometidosDe,
  enParalelo,
  imagenDeCaptura,
  pdfJugador,
  type MarcoCaptura,
  type SuJugador,
} from "@/lib/abp/pizarra-jugador";
import { buildAerialThreats, cargaAlturasBesoccer } from "@/lib/abp/rival";
import { cargaDatosMarcas } from "@/lib/abp/marcas-datos";
import { mismoClub } from "@/lib/rivals/mismoClub";
import type { Player } from "@/types/player";
import { trabajoPdfs, type EncargoPdfs } from "@/lib/abp/trabajo-pdfs";
import { subeAdjunto } from "@/lib/correo/subeAdjunto";
import { capturaLienzos, esperaFotos, pintado, respira } from "@/lib/export/lienzos";
import { traeJson } from "@/lib/hojaCsv";
import { comparativaATiempo, datoDeLamina } from "@/lib/abp/dato-lamina";
import { nombreRivalPieza } from "@/lib/abp/nombre-rival";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";

/*
| La hoja enseña sólo SU trozo de campo (unos 1150 px de los 1920 de la
| diapositiva) a lo ancho de 1080: fotografiada a 1920 sale nítida, sin
| estirar (01/11/2026; antes 0,75 y la diapositiva entera).
*/
const NITIDEZ = 1;

/** PDF que se arman a la vez: el JPEG de cada hoja se codifica fuera del hilo principal. */
const A_LA_VEZ = 3;

/**
 * Lo que se pide a la hoja (fecha del partido; nombre y altura de su hombre)
 * no puede parar los PDF: el Apps Script tarda hasta un minuto en frío. Si no
 * llega a tiempo, el pie va sin fecha y la marca, con el dorsal solo.
 */
const ESPERA_HOJA_MS = 6_000;

/** Clave de la chapa «POR» en `puntos` (no es el id de nadie). */
const PORTERO_SIN_FICHA = "__portero__";

const aTiempo = <T,>(promesa: Promise<T>, siNo: T) =>
  Promise.race([promesa.catch(() => siNo), new Promise<T>((listo) => setTimeout(() => listo(siNo), ESPERA_HOJA_MS))]);

/**
 * La fecha del partido del tablero. 10/11/2026 (jueces): manda el calendario
 * de BeSoccer, como en el informe de la semana —la hoja RIVALES decía «15
 * nov» de un partido del viernes 13 a las 21:15—; la hoja, sólo si el
 * calendario no tiene esa jornada.
 */
/*
| 12/11/2026 (jueces otra vez: «15 nov» en el pie de un partido del viernes
| 13). Causa: la fecha entera iba en UNA carrera de 6 s con la hoja RIVALES
| detrás; si el calendario no casaba por número —el tablero sin `jornada`, o
| una jornada de la hoja que no es la de BeSoccer— o tardaba, ganaba la hoja,
| que apunta el domingo de la jornada y no el día del partido. Ahora el
| calendario tiene su propia espera, casa por número Y por rival (el partido
| del calendario contra ese rival más cercano a la fecha de la hoja), y la
| hoja sólo vale si el calendario no tiene ese partido.
*/
const SIN_DIAS = 5;

const dia = (iso: string) => Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);

export async function fechaDelPartido(
  encargo: Pick<EncargoPdfs, "jornada" | "rival"> & { tablero: Pick<EncargoPdfs["tablero"], "jornada" | "rivalId" | "partidoId"> },
) {
  const numero = Number(/(\d+)/.exec(encargo.jornada ?? encargo.tablero.jornada ?? "")?.[1] ?? NaN);
  const calendario = await aTiempo(cargaCalendario(), []);
  const conCuando = calendario.filter((p) => p.cuando);
  const porNumero = Number.isFinite(numero) ? conCuando.filter((p) => Number(p.jornada) === numero) : [];
  const contraEl = conCuando.filter((p) => mismoClub(p.local, encargo.rival) || mismoClub(p.visitante, encargo.rival));

  /* Por número, y si hay dos con el mismo (otra competición), el de este rival. */
  const porAmbos = porNumero.find((p) => contraEl.includes(p));

  if (porAmbos) return porAmbos.cuando;
  if (porNumero.length === 1 && contraEl.length === 0) return porNumero[0].cuando;

  const id = encargo.tablero.rivalId || encargo.tablero.partidoId.replace(/^riv-/, "");
  const filas = await aTiempo(traeJson<FilaRival[]>("/api/rivals?action=rivales"), [] as FilaRival[]);
  const fila = (Array.isArray(filas) ? filas : []).find((f) => f && String(f.ID ?? "").trim() === id);
  const deLaHoja = fila ? aJornada(fila).fecha : "";

  /* Contra este rival en el calendario, el más cercano a lo que dice la hoja (ida o vuelta). */
  if (contraEl.length) {
    const referencia = deLaHoja ? dia(deLaHoja) : NaN;
    const cercano = Number.isFinite(referencia)
      ? [...contraEl].sort((a, b) => Math.abs(dia(a.cuando) - referencia) - Math.abs(dia(b.cuando) - referencia))[0]
      : contraEl.length === 1
        ? contraEl[0]
        : null;

    if (cercano && (!Number.isFinite(referencia) || Math.abs(dia(cercano.cuando) - referencia) <= SIN_DIAS * 86_400_000)) return cercano.cuando;
  }

  return porNumero[0]?.cuando ?? deLaHoja;
}

/** Nombre y altura de cada dorsal de su plantilla (para «Marcas al 4 Pérez (1,86 m)»). */
async function suPlantilla(rival: string) {
  const [filas] = await Promise.all([traeJson<unknown>("/api/rivals?action=rivalesPlantillas"), cargaAlturasBesoccer()]);

  return new Map<string, SuJugador>(
    buildAerialThreats(filas, [], rival)
      .filter((j) => j.dorsal)
      .map((j) => [j.dorsal, { nombre: j.nombre, altura: j.altura ?? null }]),
  );
}

/*
| 12/11/2026 (fútbol: «Marcas al 8» sin decir a quién). La plantilla de la
| hoja no siempre casa con el nombre del rival del tablero, y el dorsal de
| «Quién marca a quién» sale de SU once probable (`cargaDatosMarcas`): de ahí
| salen también el nombre y la altura. Se juntan las dos; manda la hoja si ya
| trae nombre, y lo que falte lo pone el once probable.
*/
async function susNombres(rival: string, players: Map<string, Player>) {
  const [hoja, marcas] = await Promise.all([
    suPlantilla(rival).catch(() => new Map<string, SuJugador>()),
    cargaDatosMarcas(rival, [...players.values()]).catch(() => null),
  ]);
  const juntos = new Map(hoja);

  for (const atacante of marcas?.atacantes ?? []) {
    const dorsal = String(atacante.dorsal ?? "").trim();

    if (!dorsal || !atacante.nombre) continue;

    const previo = juntos.get(dorsal);

    juntos.set(dorsal, { nombre: previo?.nombre || atacante.nombre, altura: previo?.altura ?? atacante.altura ?? null });
  }

  return juntos;
}

/**
 * Cómo cae la plantilla en la foto de una diapositiva. Al enseñarla, la
 * pizarra acerca el campo a la jugada (una capa con `scale` y `translate`
 * dentro de una caja que recorta): se mide esa capa y esa caja en el DOM, en
 * píxeles del tablero. Sin capa, la foto es la plantilla tal cual.
 */
function marcoDe(nodo: HTMLElement): MarcoCaptura | null {
  const caja = nodo.getBoundingClientRect();
  const escala = TABLERO_W / Math.max(1, caja.width);
  let capa = nodo.querySelector<HTMLElement>("[data-ficha]")?.parentElement ?? null;

  while (capa && capa !== nodo && !/translate\(/.test(capa.style.transform)) capa = capa.parentElement;

  if (!capa || capa === nodo || !capa.parentElement) return null;

  const r = capa.getBoundingClientRect();
  const recorte = capa.parentElement.getBoundingClientRect();

  if (!r.width || !recorte.width) return null;

  return {
    k: (r.width * escala) / TABLERO_W,
    dx: (r.left - caja.left) * escala,
    dy: (r.top - caja.top) * escala,
    campo: {
      x: (recorte.left - caja.left) * escala,
      y: (recorte.top - caja.top) * escala,
      w: recorte.width * escala,
      h: recorte.height * escala,
    },
  };
}

export function MesaPdfs({
  encargo,
  alTerminar,
}: {
  encargo: EncargoPdfs;
  alTerminar: (resumen: { listos: number; fallos: number }) => void;
}) {
  const raizRef = useRef<HTMLDivElement>(null);

  const porJugador = useMemo(
    () => new Map(encargo.ids.map((id) => [id, cometidosDe(encargo.tablero, id, encargo.players)])),
    [encargo],
  );

  /* Las diapositivas que salen en algún PDF, cada una una sola vez. */
  const indices = useMemo(
    () => [...new Set([...porJugador.values()].flat().map((accion) => accion.indice))].sort((a, b) => a - b),
    [porJugador],
  );

  useEffect(() => {
    let vivo = true;

    void (async () => {
      let listos = 0;
      let fallos = 0;

      try {
        const raiz = raizRef.current;

        if (!raiz) throw new Error("Sin mesa de trabajo");

        /* Lo de la hoja, a la vez que se montan y fotografían las diapositivas. */
        /* La fecha lleva sus propias esperas (calendario y hoja, cada una la suya). */
        const fechaEnCamino = fechaDelPartido(encargo).catch(() => "");
        const suyosEnCamino = aTiempo(susNombres(encargo.rival, encargo.players), new Map<string, SuJugador>());
        /* La cifra del rival de cada acción, de la comparativa del informe de ABP (12/11/2026). */
        const comparativaEnCamino = comparativaATiempo();

        await pintado();
        await esperaFuentePortada();
        await esperaFotos(raiz);

        if (!vivo) return;

        /* Dónde cae la cara de cada uno en cada diapositiva (1920×1080), y cómo cae la plantilla. */
        const puntos = new Map<string, { x: number; y: number }>();
        const marcos = new Map<number, MarcoCaptura | null>();

        Array.from(raiz.querySelectorAll<HTMLElement>("[data-abp-tablero]")).forEach((nodo, k) => {
          marcos.set(indices[k], marcoDe(nodo));

          const caja = nodo.getBoundingClientRect();
          const escala = TABLERO_W / Math.max(1, caja.width);

          nodo.querySelectorAll<HTMLElement>("[data-player]").forEach((ficha) => {
            const clave = `${indices[k]}:${ficha.dataset.player}`;
            const cara = ficha.querySelector("img")?.getBoundingClientRect();

            if (cara && !puntos.has(clave)) {
              puntos.set(clave, {
                x: (cara.left + cara.width / 2 - caja.left) * escala,
                y: (cara.top + cara.height / 2 - caja.top) * escala,
              });
            }
          });

          /* La chapa «POR» de nuestro portero (sin ficha): ahí va su aro, medida como las caras. */
          const disco = nodo.querySelector<HTMLElement>("[data-portero]")?.firstElementChild?.getBoundingClientRect();

          if (disco?.width) {
            puntos.set(`${indices[k]}:${PORTERO_SIN_FICHA}`, {
              x: (disco.left + disco.width / 2 - caja.left) * escala,
              y: (disco.top + disco.height / 2 - caja.top) * escala,
            });
          }
        });

        const t0 = performance.now();
        const escudosEnCamino = cargaEscudos(encargo.escudoRival);

        const capturas = await capturaLienzos(raiz, "[data-abp-tablero]", {
          ancho: TABLERO_W,
          alto: TABLERO_H,
          fondo: COLORES.tinta,
          nitidez: NITIDEZ,
        });

        /* Cada foto se decodifica UNA vez para todos (antes, una por jugador y acción). */
        const imagenes = await Promise.all(capturas.map((captura) => imagenDeCaptura(captura ?? "")));
        const porIndice = new Map(indices.map((indice, k) => [indice, imagenes[k] ?? null]));
        const escudos = await escudosEnCamino;
        const [fecha, suyos, comparativa] = await Promise.all([fechaEnCamino, suyosEnCamino, comparativaEnCamino]);
        const rivalTexto = nombreRivalPieza(encargo.rival) || encargo.rival;
        const datoDe = (indice: number) => datoDeLamina(encargo.tablero.slides[indice]?.plantilla ?? "", comparativa, rivalTexto);
        const t1 = performance.now();

        await enParalelo(encargo.ids, A_LA_VEZ, async (id) => {
          if (!vivo) return;

          const acciones = (porJugador.get(id) ?? []).map((accion) => {
            const dato = datoDe(accion.indice);

            return dato ? { ...accion, dato } : accion;
          });

          if (acciones.length === 0) {
            trabajoPdfs.salta();
            return;
          }

          trabajoPdfs.empieza(id);

          try {
            const pdf = await pdfJugador({
              player: encargo.players.get(id),
              acciones,
              tableros: acciones.map((accion) => porIndice.get(accion.indice) ?? null),
              puntos: acciones.map(
                (accion) =>
                  puntos.get(`${accion.indice}:${id}`) ??
                  (accion.sinFicha && accion.portero ? puntos.get(`${accion.indice}:${PORTERO_SIN_FICHA}`) : null) ??
                  null,
              ),
              marcos: acciones.map((accion) => marcos.get(accion.indice) ?? null),
              suyos,
              rival: encargo.rival,
              jornada: encargo.jornada,
              fecha,
              escudos,
            });

            trabajoPdfs.apunta(encargo.huella, id, pdf);
            listos += 1;

            /* Subido ya, para que el toque de WhatsApp abra el chat al instante. */
            subeAdjunto(new File([pdf.blob], pdf.nombre, { type: "application/pdf" }))
              .then((subido) => trabajoPdfs.enlaza(id, pdf.blob, subido.url))
              .catch((error) => console.warn("[abp-pizarra] subida del PDF", error));
          } catch (error) {
            console.error("[abp-pizarra] PDF del jugador", error);
            fallos += 1;
            trabajoPdfs.salta();
          }

          /* Respiro entre uno y otro: la app sigue respondiendo mientras se navega (sin reloj: escondida, se alargaría). */
          await respira();
        });

        console.info(
          `[abp-pizarra] PDF por jugador: ${indices.length} diapositivas fotografiadas en ${Math.round(t1 - t0)} ms, ` +
            `${listos} PDF armados en ${Math.round(performance.now() - t1)} ms`,
        );
      } catch (error) {
        console.error("[abp-pizarra] PDF por jugador", error);
        fallos += Math.max(1, encargo.ids.length - listos);
      }

      if (!vivo) return;

      trabajoPdfs.termina();
      alTerminar({ listos, fallos });
    })();

    return () => {
      vivo = false;
    };
    /* Una pasada por encargo: `alTerminar` cambia en cada render del anfitrión. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encargo, indices, porJugador]);

  return (
    <div
      ref={raizRef}
      aria-hidden
      data-export-hide
      className="pointer-events-none"
      style={{ position: "fixed", top: 0, left: -(TABLERO_W + 200), width: TABLERO_W, zIndex: -1 }}
    >
      {indices.map((indice) => (
        <div key={indice} style={{ width: TABLERO_W }}>
          <TableroSlide
            slide={encargo.tablero.slides[indice]}
            titulo={tituloVisible(encargo.tablero.slides, indice)}
            soloVer
            sinCasillasVacias
            players={encargo.players}
            temporada={encargo.temporada}
            rival={encargo.rival}
            seleccion={null}
            onMover={() => undefined}
            onQuitar={() => undefined}
            onPulsarPuesto={() => undefined}
            onSeleccionar={() => undefined}
          />
        </div>
      ))}
    </div>
  );
}
