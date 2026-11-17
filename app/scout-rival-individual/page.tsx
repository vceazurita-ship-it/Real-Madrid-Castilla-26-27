"use client";

/**
 * Scout individual del rival: los cortes de nuestro canal, jugador a jugador.
 *
 * Antes esta pantalla era una videoteca de clips de Hudl apuntados en una hoja:
 * seis desplegables de facetas, un buscador y trescientas fichas. Se ha quitado
 * (11/09/2026). El material con el que de verdad se prepara un rival es el que
 * montamos nosotros en `/coding`, que acaba en el canal de YouTube con **una
 * lista por equipo**, y tenerlo en otra pestaña del navegador —con la hoja de
 * Hudl al lado como segunda fuente— era pedirle al analista que eligiera entre
 * dos sitios cada vez.
 *
 * Así que aquí sólo hay una cosa, y se entra por donde se piensa: **primero el
 * rival, después el jugador**. El equipo se elige arriba con su escudo, y
 * debajo están sus vídeos repartidos por jugador (`VideosDelCanal`).
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Eye, ListVideo, Users, Video as IconoVideo } from "lucide-react";
import { RadiografiaDelOnce } from "@/components/rivals/RadiografiaDelOnce";
import { useCalendario } from "@/hooks/useCalendario";
import { comoNuestro } from "@/lib/castilla/calendario";
import { nombreEquipo } from "@/lib/equipos";
import { colocacionDelCampograma } from "@/lib/duelos-onces";
import { puestoDelRival } from "@/lib/rivals/colocacion-once";
import { casaNombre } from "@/lib/data-analisis/once";
import { bajaDe } from "@/lib/rivals/bajas";
import { findInforme, type InformeDoc } from "@/lib/rivals/informe";
import type { Puesto } from "@/lib/data-analisis/individual";
import type { RasgoCorto } from "@/lib/rivals/youtube-listas";
import { AccesosDelRival } from "@/components/rivals/AccesosDelRival";
import { Pestanas, usePestanaUrl } from "@/components/analisis/Pestanas";
import { PanelVisionados } from "@/components/visionados/PanelVisionados";

import { EsqueletoPantalla, EstadoVacio } from "@/components/ui/estados";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { EscudoEquipo } from "@/components/rivals/EscudoEquipo";
import { VideosDelCanal } from "@/components/rivals/VideosDelCanal";
import { AvisoLento } from "@/components/rivals/AvisoLento";
import { ClipsHudlDelRival } from "@/components/rivals/ClipsDeHudl";
import { useEscudos } from "@/hooks/useEscudos";
import { useLento } from "@/hooks/useLento";
import { useRivalSquads } from "@/hooks/useRivalSquads";
import { useRivalStats } from "@/hooks/useRivalStats";
import { traeJson } from "@/lib/hojaCsv";
import { findStats, highlightSeason } from "@/lib/rivals/stats";
import { normalizarOnce, playerKey, rivalOnceKey } from "@/lib/rivals/once";
import {
  SIN_ORDEN,
  cargaOrdenRivales,
  comparaPorCalendario,
  esElProximo,
  jornadaDeEquipo,
  type OrdenRivales,
} from "@/lib/rivals/orden-calendario";
import { Explicativo } from "@/components/ui/textos-analisis";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { conTildes } from "@/lib/rivals/tildes";
import { comoNombre } from "@/lib/duelos-onces";
import { rotuloDePuesto } from "@/lib/rivals/lineas-puesto";
import { useRivalPerfiles } from "@/hooks/useRivalPerfiles";
import { asignaPerfiles, type PerfilWyscout, type RasgoWyscout } from "@/lib/rivals/perfil-wyscout";
import { formatea } from "@/lib/data-analisis/metricas";

/*
| UNA CIFRA DE SU PUESTO EN CADA FICHA (16/11/2026, tercera vuelta): la
| pantalla era una galería con poco dato. De Wyscout (`?perfiles=`, la misma
| cuenta que /rivals), su rasgo más fuerte y su más flojo contra los de su
| puesto, con el percentil, contra cuántos y sus minutos. Con muestra corta
| (menos de 270′), nada.
*/
/*
| EN DOS PARTES (17/11/2026, ronda 21, marketing): lo corto para la línea de
| la tarjeta («Acciones de ataque exitosas 2,7 · P91») y la base entera para
| «Ver base» («P91 entre 117 laterales · 1.017′ en Wyscout»).
*/
function rasgosDePerfil(perfil: PerfilWyscout | undefined): RasgoCorto[] {
  if (!perfil || perfil.muestraCorta) return [];

  /*
  | «Faltas cometidas 1,4 · P30» no se leía como explotable (16/11/2026, ronda
  | 18, fútbol): en las de «menos es mejor» el percentil ya va al revés, así
  | que se dice con palabras: «más que 7 de cada 10 laterales».
  */
  const escribe = (r: RasgoWyscout, signo: "▲" | "▼"): RasgoCorto => {
    const minutos = `${perfil.minutos.toLocaleString("es-ES")}′ en Wyscout`;
    const puesto = perfil.puestoLabel.toLowerCase();
    const percentil = Math.round(r.percentil);
    /* Un porcentaje con sus intentos (17/11/2026, ronda 19): «50 % · 10 de 20». */
    const deIntentos = r.unidad === "porcentaje" && r.intentos ? ` (${Math.round((r.valor * r.intentos) / 100)} de ${r.intentos})` : "";

    /* «Porterías a cero 5,0» era un total, no un «por 90′» (17/11/2026, jueces de fútbol). */
    if (/porter[ií]as? a cero/i.test(r.nombre)) {
      return {
        signo,
        corta: `Porterías a cero: ${Math.round(r.valor)} en ${perfil.partidos}`,
        marca: `P${percentil}`,
        percentil,
        base: `${Math.round(r.valor)} en ${perfil.partidos} ${perfil.partidos === 1 ? "partido" : "partidos"} · P${percentil} entre ${perfil.iguales} ${puesto} · ${minutos}`,
      };
    }

    if (r.mejorAlto === false) {
      const flojo = signo === "▼";
      const de10 = Math.min(9, Math.max(1, Math.round((flojo ? 100 - r.percentil : r.percentil) / 10)));
      const frase = `${flojo ? "más" : "menos"} que ${de10} de cada 10 ${puesto}`;

      return {
        signo,
        corta: `${r.nombre} ${formatea(r.valor, r.unidad)}`,
        marca: `${flojo ? "más" : "menos"} que ${de10} de 10`,
        percentil,
        base: `${formatea(r.valor, r.unidad)}${deIntentos} · ${frase} (aquí menos es mejor) · ${minutos}`,
      };
    }

    return {
      signo,
      corta: `${r.nombre} ${formatea(r.valor, r.unidad)}`,
      marca: `P${percentil}`,
      percentil,
      base: `${formatea(r.valor, r.unidad)}${deIntentos} · P${percentil} entre ${perfil.iguales} ${puesto} · ${minutos}`,
    };
  };

  /*
  | 17/11/2026 (ronda 19, jueces de fútbol): fuera del ▲/▼ los porcentajes de
  | menos de 15 intentos y los penaltis («Penaltis marcados 100 %» de Flakus no
  | es lo que le hace peligroso). Al delantero, si la tiene, una de remate o xG.
  */
  const vale = (r: RasgoWyscout) => !/penalti/i.test(r.nombre) && !(r.unidad === "porcentaje" && r.intentos != null && r.intentos < 15);
  const fuertes = perfil.fuertes.filter(vale);
  const delantero = /delanter/i.test(perfil.puestoLabel);
  const fuerte = (delantero ? fuertes.find((r) => /xg|remate|gol/i.test(r.nombre)) : undefined) ?? fuertes[0];
  /* Todo titular con su ▼: si nada llega a «flojo», su cifra más baja (por debajo de la mediana). */
  const flojo = perfil.flojos.filter(vale)[0] ?? (perfil.minutos >= 450 ? perfil.peor ?? undefined : undefined);

  return [...(fuerte ? [escribe(fuerte, "▲")] : []), ...(flojo ? [escribe(flojo, "▼")] : [])];
}

/*
| UNA SOLA POBLACIÓN POR PUESTO, Y DICHA (17/11/2026, ronda 21, fútbol): la
| comparación es siempre la de Wyscout (su puesto donde más juega). Si no es la
| de su puesto de la hoja —Palmberg, mediapunta en la hoja, va con los medios—
| se dice por qué: «pivote en su once, comparado con 123 medios», como Duelos.
*/
const FAMILIAS: [RegExp, Puesto][] = [
  [/portero/, "POR"],
  [/central/, "CEN"],
  [/lateral|carrilero/, "LAT"],
  [/media\s*punta|extremo|banda/, "BAN"],
  [/pivote|medio|interior|centrocampista|volante/, "MED"],
  [/delanter|punta/, "DEL"],
];

const familiaDe = (texto: string) => FAMILIAS.find(([re]) => re.test(texto.toLowerCase()))?.[1];

function poblacionDe(perfil: PerfilWyscout | undefined, origen: string, enElOnce: string | null) {
  if (!perfil || perfil.muestraCorta) return "";

  const familia = familiaDe(origen);

  if (!familia || familia === perfil.puesto) return "";

  const comparado = `comparado con ${perfil.iguales} ${perfil.puestoLabel.toLowerCase()}`;

  if (enElOnce && familiaDe(enElOnce) === perfil.puesto) return `${enElOnce} en su once, ${comparado}`;

  return perfil.posicionTexto ? `en Wyscout juega sobre todo de ${perfil.posicionTexto.toLowerCase()}: ${comparado}` : `Wyscout le cuenta con los ${perfil.puestoLabel.toLowerCase()}: ${comparado}`;
}

const conMayuscula = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** «2026-11-22T18:45» → «22/11». */
const diaCorto = (cuando: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(cuando ?? "");

  return m ? `${m[3]}/${m[2]}` : "";
};

/*
| `?equipo=<NOMBRE>` (26/10/2026): desde la ficha del rival o la portada se
| llega con el equipo puesto. Se lee como en el microciclo ABP, con
| `useSyncExternalStore` y la instantánea de servidor vacía: sin `Suspense` y
| sin desajuste al hidratar.
*/
const leeEquipoEnlazado = () => new URLSearchParams(window.location.search).get("equipo") ?? "";

const leeJugadorEnlazado = () => new URLSearchParams(window.location.search).get("jugador") ?? "";

const sinEquipoEnlazado = () => "";

function seSabraAlLlegar(avisa: () => void) {
  const aviso = setTimeout(avisa, 0);

  return () => clearTimeout(aviso);
}

export default function ScoutRivalIndividual() {
  /* Tres pestañas: los clips, la lista del canal (secundaria, 17/11/2026, ronda 21) y quién los ve. */
  const [vista, setVista] = usePestanaUrl<"clips" | "lista" | "visionados">("vista", ["clips", "lista", "visionados"], "clips");
  const escudoDe = useEscudos();

  const { squads, loading, error, reintenta } = useRivalSquads();

  /* 8 s y no 25 (30/10/2026): pasado ese rato se dice y se deja reintentar. */
  const lento = useLento(loading, 8_000);

  const [equipoPedido, setEquipoPedido] = useState("");

  /*
  | El orden de la fila es el del calendario, no el alfabeto.
  |
  | Es la misma regla que `/rivals` —a cada equipo, la fecha de su siguiente
  | partido— y por el mismo motivo: al preparar la semana se busca al rival que
  | toca, y en una fila alfabética está donde caiga. `cargaOrdenRivales` nunca
  | lanza: sin calendario, todos quedan empatados y vuelve el alfabeto.
  |
  | `claveDeHoy()` mira el reloj, así que va dentro del efecto y no en el cuerpo
  | del componente (ver la regla de pureza de React).
  */
  const [orden, setOrden] = useState<OrdenRivales>(SIN_ORDEN);

  /* Ya se sabe el orden (o que no se va a saber: `cargaOrdenRivales` no lanza). */
  const [ordenListo, setOrdenListo] = useState(false);

  useEffect(() => {
    const control = new AbortController();

    void cargaOrdenRivales(control.signal).then((leido) => {
      if (control.signal.aborted) return;

      setOrden(leido);
      setOrdenListo(true);
    });

    return () => control.abort();
  }, []);

  /*
  | Los equipos salen de las plantillas y, mientras la hoja no contesta, del
  | calendario (30/10/2026): la tira de escudos y los vídeos del canal no
  | dependen de la plantilla, así que no se hace esperar 30-70 s a nadie por
  | ella. Cuando llega, los cortes se reparten por jugador.
  */
  const equipos = useMemo(
    () =>
      (squads.length ? squads.map((squad) => squad.equipo) : orden.equipos)
        .filter(Boolean)
        .sort(comparaPorCalendario(orden)),
    [squads, orden],
  );

  /* Sin pedir ninguno, el de por defecto es el primero POR CALENDARIO: hasta
     que llega el orden no se elige, o se montaban y pedían a YouTube los
     vídeos del primero por alfabeto y luego se cambiaba (19/10/2026). */
  const equipoEnlazado = useSyncExternalStore(seSabraAlLlegar, leeEquipoEnlazado, sinEquipoEnlazado);

  /* El de la URL manda sobre el del calendario, si está en las plantillas. */
  const delEnlace = equipoEnlazado
    ? (equipos.find((e) => e === equipoEnlazado) ?? equipos.find((e) => mismoClub(e, equipoEnlazado)) ?? "")
    : "";

  const equipo = equipoPedido || delEnlace || (ordenListo ? equipos[0] : "") || "";

  /* `?jugador=<nombre>` (16/11/2026, desde Duelos): se abre con sus cortes filtrados, si es de este rival. */
  const jugadorEnlazado = useSyncExternalStore(seSabraAlLlegar, leeJugadorEnlazado, sinEquipoEnlazado);

  /*
  | Las etiquetas de cada jugador (campo IMPACTO de la hoja, separadas por «;»),
  | para decir bajo cada corte qué mirar de él. La hoja ya está en la copia del
  | aparato: `traeJson` no vuelve a pedirla.
  */
  const [etiquetasDe, setEtiquetasDe] = useState<Record<string, string[]>>({});

  /* Su clave de jugador (la del once marcado), por «equipo|nombre». */
  const [clavesDe, setClavesDe] = useState<Record<string, string>>({});

  /* La fila de la hoja de cada jugador, para cruzarla con sus números de BeSoccer. */
  const [filasDe, setFilasDe] = useState<Record<string, Record<string, unknown>>>({});

  const { doc: statsDoc } = useRivalStats();

  /*
  | Las vistas de YouTube (11/11/2026, el analista): los jugadores ven los
  | clips en el canal, no en la app, así que la cifra de cada ficha y la de la
  | pestaña son las vistas de YouTube. Sólo se lee.
  */
  const [vistasPorVideo, setVistasPorVideo] = useState<Record<string, number>>({});

  useEffect(() => {
    let vivo = true;

    fetch("/api/youtube/visionados", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ clips?: { id: string; vistas: number }[] }>)
      .then((j) => {
        if (!vivo || !Array.isArray(j?.clips)) return;

        setVistasPorVideo(Object.fromEntries(j.clips.filter((c) => c?.id).map((c) => [c.id, Number(c.vistas) || 0])));
      })
      .catch(() => undefined);

    return () => {
      vivo = false;
    };
  }, []);


  /* El once probable marcado en Plantillas rivales, con su dibujo y sus puestos (sólo se lee). */
  const [onceDe, setOnceDe] = useState<{ equipo: string; claves: string[]; dibujo?: string; puestos?: Record<string, string> }>({ equipo: "", claves: [] });

  useEffect(() => {
    if (!equipo) return;

    let vivo = true;

    fetch(`/api/docs?key=${encodeURIComponent(rivalOnceKey(equipo))}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ data?: unknown }>)
      .then((j) => {
        const marcado = normalizarOnce(j?.data ?? null);

        if (vivo) setOnceDe({ equipo, claves: marcado.titulares, dibujo: marcado.dibujo, puestos: marcado.puestos });
      })
      .catch(() => undefined);

    return () => {
      vivo = false;
    };
  }, [equipo]);

  /*
  | Sus onces de BeSoccer (rivals:informe), como Duelos (17/11/2026, ronda
  | 21): sin once marcado, su último once; y de ahí, dónde juega cada uno en su
  | once para el puesto que se enseña («pivote en su once (mediapunta de origen)»).
  */
  const [informes, setInformes] = useState<InformeDoc | null>(null);

  useEffect(() => {
    let vivo = true;

    fetch(`/api/docs?key=${encodeURIComponent("rivals:informe")}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ data?: InformeDoc | null }>)
      .then((j) => {
        if (vivo) setInformes(j?.data ?? null);
      })
      .catch(() => undefined);

    return () => {
      vivo = false;
    };
  }, []);

  /* La jornada (17/11/2026, ronda 21): un desplegable con nuestros partidos contra este rival; abre la lista de ese partido. */
  const { partidos } = useCalendario();

  const jornadasDelRival = useMemo(
    () =>
      partidos
        .map((p) => comoNuestro(p))
        .filter((p) => p.jornada && p.rival && equipo && mismoClub(nombreEquipo(p.rival), equipo))
        .sort((a, b) => a.jornada - b.jornada),
    [partidos, equipo],
  );

  const [jornadaPedida, setJornadaPedida] = useState<{ equipo: string; jornada: number }>({ equipo: "", jornada: 0 });

  const jornadaPorDefecto = Number(jornadaDeEquipo(orden, equipo)?.etiqueta.replace(/\D/g, "")) || jornadasDelRival.at(-1)?.jornada || 0;

  const jornada = jornadaPedida.equipo === equipo && jornadaPedida.jornada ? jornadaPedida.jornada : jornadaPorDefecto;

  /* Cuántos cortes del canal tiene cada uno: lo dice VideosDelCanal cuando ha leído la lista. */
  const [reparto, setReparto] = useState<{ equipo: string; cuenta: Record<string, number> | null }>({ equipo: "", cuenta: null });

  const alRepartir = useCallback((cuenta: Record<string, number> | null) => setReparto({ equipo, cuenta }), [equipo]);

  const cortes = reparto.equipo === equipo ? reparto.cuenta : null;

  useEffect(() => {
    let cancelado = false;

    traeJson<unknown>("/api/rivals?action=rivalesPlantillas")
      .then((filas) => {
        if (cancelado || !Array.isArray(filas)) return;

        const mapa: Record<string, string[]> = {};
        const claves: Record<string, string> = {};
        const filasPorClave: Record<string, Record<string, unknown>> = {};

        for (const fila of filas as Record<string, unknown>[]) {
          const nombre = String(fila["NOMBRE DEPORTIVO"] ?? "").trim() || String(fila.JUGADOR ?? "").trim();
          const etiquetas = String(fila.IMPACTO ?? "")
            .split(";")
            .map((e) => e.trim())
            .filter(Boolean);

          if (nombre && etiquetas.length) mapa[`${String(fila.NOMBRE_EQUIPO ?? "").trim()}|${nombre}`] = etiquetas;
          if (nombre) claves[`${String(fila.NOMBRE_EQUIPO ?? "").trim()}|${nombre}`] = playerKey(fila);
          if (nombre) filasPorClave[`${String(fila.NOMBRE_EQUIPO ?? "").trim()}|${nombre}`] = fila;
        }

        setEtiquetasDe(mapa);
        setClavesDe(claves);
        setFilasDe(filasPorClave);
      })
      .catch(() => undefined);

    return () => {
      cancelado = true;
    };
  }, []);

  /*
  | DORSALES REPETIDOS (30/10/2026, fútbol y análisis): la hoja trae el 19
  | para Adrián Corral y para Marcelo. Hasta que se corrija en la hoja RIVALES,
  | un dorsal que se repite dentro del mismo rival no se pinta en ninguno de
  | los dos —el cuerpo técnico nunca ve dos números iguales— y se avisa al
  | analista en la consola.
  */
  const dorsalesRepetidos = useMemo(() => {
    const cuenta = new Map<string, string[]>();

    for (const jugador of squads.find((squad) => squad.equipo === equipo)?.players ?? []) {
      const dorsal = String(jugador.dorsal ?? "").trim();

      if (!dorsal) continue;

      cuenta.set(dorsal, [...(cuenta.get(dorsal) ?? []), jugador.nombre]);
    }

    return new Map([...cuenta].filter(([, nombres]) => nombres.length > 1));
  }, [squads, equipo]);

  useEffect(() => {
    for (const [dorsal, nombres] of dorsalesRepetidos) {
      console.warn(`[scout individual] ${equipo}: el dorsal ${dorsal} está repetido en la hoja (${nombres.join(" y ")}). No se pinta hasta corregirlo en RIVALES.`);
    }
  }, [dorsalesRepetidos, equipo]);

  const perfilesRival = useRivalPerfiles(equipo);

  const perfilPorFicha = useMemo(() => {
    if (!perfilesRival) return new Map<string, PerfilWyscout>();

    const delEquipo = Object.entries(filasDe)
      .filter(([k]) => k.startsWith(`${equipo}|`))
      .map(([k, fila]) => ({ JUGADOR: fila.JUGADOR, "NOMBRE DEPORTIVO": fila["NOMBRE DEPORTIVO"], __k: k }));

    return asignaPerfiles(delEquipo, perfilesRival.perfiles, (f) => f.__k);
  }, [perfilesRival, filasDe, equipo]);

  /*
  | EL MISMO ONCE QUE PLANTILLAS RIVALES Y DUELOS (17/11/2026, ronda 21): el
  | marcado en Plantillas si tiene siete o más; si no, su último once de
  | BeSoccer. Fuera los lesionados y sancionados de su ficha, y se dice.
  */
  const once = useMemo(() => {
    const suyos = (squads.find((squad) => squad.equipo === equipo)?.players ?? []).map((j) => ({
      nombre: j.nombre,
      clave: clavesDe[`${equipo}|${j.nombre}`] ?? "",
      fila: filasDe[`${equipo}|${j.nombre}`],
    }));
    const deLaPlantilla = new Set(suyos.map((j) => j.clave).filter(Boolean));
    const marcados = onceDe.equipo === equipo ? onceDe.claves.filter((c) => deLaPlantilla.has(c)) : [];
    let claves: string[] = [];
    let fuente = "";

    if (marcados.length >= 7) {
      claves = marcados;
      fuente = "Once probable marcado en Plantillas rivales";
    } else {
      const ultimo = findInforme(informes, equipo)?.onces?.find((o) => o.jugadores.length > 0);
      const casados = (ultimo?.jugadores ?? [])
        .map((u) => casaNombre(u.nombre, suyos, (j) => j.nombre)?.clave ?? "")
        .filter(Boolean);

      if (casados.length >= 7) {
        claves = casados;
        fuente = `Su último once en BeSoccer${ultimo?.estructura ? ` (${ultimo.estructura})` : ""}: nadie ha marcado el once probable`;
      }
    }

    const fuera = suyos.filter((j) => claves.includes(j.clave) && j.fila && ["lesionado", "sancionado"].includes(bajaDe(j.fila) ?? ""));

    if (fuera.length) {
      fuente += `, sin ${fuera.map((j) => `${conTildes(comoNombre(j.nombre))} (${bajaDe(j.fila!)})`).join(" ni ")}`;
    }

    return { claves: new Set(claves.filter((c) => !fuera.some((j) => j.clave === c))), fuente };
  }, [squads, equipo, clavesDe, filasDe, onceDe, informes]);

  /* Dónde cae cada titular en su once, con la cuenta del campograma de /rivals (la de Duelos). */
  const colocacion = useMemo(
    () =>
      colocacionDelCampograma(
        Object.entries(filasDe)
          .filter(([k]) => k.startsWith(`${equipo}|`))
          .map(([, f]) => f),
        equipo,
        findInforme(informes, equipo),
        /* Con los titulares (18/11/2026): uno por hueco, el mismo once de /rivals (11 en 11, nunca dos laterales derechos). */
        { dibujo: onceDe.equipo === equipo ? onceDe.dibujo : undefined, puestos: onceDe.equipo === equipo ? onceDe.puestos : undefined, titulares: [...once.claves] },
      ),
    [filasDe, equipo, informes, onceDe, once],
  );

  const plantilla = useMemo(
    () =>
      (squads.find((squad) => squad.equipo === equipo)?.players ?? []).map((jugador) => {
        const fila = filasDe[`${equipo}|${jugador.nombre}`];
        const stats = fila ? findStats(statsDoc, fila) : null;
        const temporada = stats ? highlightSeason(stats.temporadas, statsDoc?.temporada) : null;
        const clave = clavesDe[`${equipo}|${jugador.nombre}`];
        const titular = Boolean(clave) && once.claves.has(clave!);
        const perfil = perfilPorFicha.get(`${equipo}|${jugador.nombre}`);
        /* El puesto de todas las pantallas: «pivote en su once (mediapunta de origen)» sólo en los del once. */
        const enSuOnce = titular ? puestoDelRival(String(jugador.posicion ?? ""), colocacion.get(clave!) ?? null) : null;
        const puesto = rotuloDePuesto(String(jugador.posicion ?? ""));

        return {
        partidos: temporada?.partidos,
        titularidades: temporada?.titular,
        minutos: temporada?.minutos,
        clave: clavesDe[`${equipo}|${jugador.nombre}`],
        amarillas: temporada?.amarillas,
        goles: temporada?.goles,
        asistencias: temporada?.asistencias,
        rasgos: rasgosDePerfil(perfil),
        poblacion: poblacionDe(perfil, puesto, enSuOnce?.enElOnce ?? null),
        rol: enSuOnce?.enElOnce ? conMayuscula(enSuOnce.texto) : "",
        /* Como en Plantillas, con tildes y en caja de nombre: «SAMU VAZQUEZ» → «Samu Vázquez» (07/11/2026). */
        nombre: conTildes(comoNombre(jugador.nombre)),
        hoja: jugador.nombre,
        dorsal: dorsalesRepetidos.has(String(jugador.dorsal ?? "").trim()) ? "" : jugador.dorsal,
        /* El rótulo de Plantillas rivales: «MEDIO CENTRO» → «Mediocentro» (08/11/2026, jueces). */
        puesto,
        etiquetas: etiquetasDe[`${equipo}|${jugador.nombre}`] ?? [],
        titular,
        };
      }),
    [squads, equipo, etiquetasDe, clavesDe, once, colocacion, filasDe, statsDoc, dorsalesRepetidos, perfilPorFicha],
  );

  const titulares = useMemo(() => plantilla.filter((j) => j.titular), [plantilla]);

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="p-4 sm:p-6 md:p-10">
          {/* --------------------------- CABECERA -------------------------- */}

          <header className="min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              RMCF CASTILLA · SCOUTING
            </p>

            {/* El título dice a quién se mira (30/10/2026). */}
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              {/* Visionados: el título no repite la pestaña (07/11/2026). */}
              {vista !== "visionados" && equipo ? `Vídeos · ${equipo}` : "Vídeos del rival"}
            </h1>

            {vista !== "visionados" && <Explicativo>
            <p className="mt-3 max-w-2xl text-white/60">
              Los cortes que montamos en el coding, repartidos por jugador. Cada
              rival tiene su lista en nuestro canal y aquí se ve sin salir de la
              plataforma.
            </p>
            </Explicativo>}
            <p className="mt-3 max-w-2xl text-white/60">
              {vista === "visionados" ? "Cuántas veces se ven los clips en YouTube, donde los ven los jugadores." : "Los cortes de cada rival, jugador a jugador."}
            </p>

            {/* El resto del área con este rival puesto: sus goles en vídeo, el Plan, el ABP… (16/11/2026, ronda 18). */}
            {vista !== "visionados" && equipo && <AccesosDelRival equipo={equipo} aqui="/scout-rival-individual" className="mt-4" />}
          </header>

          <div className="mt-5">
            <Pestanas
              etiqueta="Clips individuales"
              valor={vista}
              onCambia={setVista}
              opciones={[
                { clave: "clips", label: "Clips", icono: IconoVideo },
                /* La lista del canal, secundaria (17/11/2026, ronda 21, análisis): se empareja sola; aquí se cambia. */
                { clave: "lista", label: "Lista del canal", corto: "Lista", icono: ListVideo },
                /* Sin la cifra suelta (16/11/2026, marketing): «Visionados 499» no decía de qué; dentro se explica quién y cuándo. */
                { clave: "visionados", label: "Visionados en YouTube", corto: "Visionados", icono: Eye },
              ]}
            />
          </div>

          {vista === "visionados" ? (
            <div className="mt-5"><PanelVisionados /></div>
          ) : (
          <>

          {/* Si la hoja tarda más de 8 s, o falla, se dice y se deja reintentar. */}
          {(lento || (error && !loading)) && (
            <AvisoLento className="mt-6" onReintentar={reintenta} />
          )}

          {/* ---------------------- A QUIÉN SE MIRA ------------------------ */}

          {/*
          | UN SOLO SELECTOR DE RIVAL (16/11/2026, ronda 18, análisis y
          | marketing): el mismo rival se elegía de tres maneras (tira de
          | escudos, «Cambiar equipo» y la lista del canal). Queda una fila con
          | su escudo y un desplegable ordenado por calendario; la lista del
          | canal va plegada debajo, en los vídeos.
          */}
          <section className="mt-6 min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            {equipos.length === 0 && loading && !ordenListo ? (
              <div className="h-10 w-full max-w-md animate-pulse rounded-xl bg-white/[0.05]" />
            ) : (
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                {equipo && <EscudoEquipo nombre={equipo} escudo={escudoDe(equipo)} lado={28} />}
                <label className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-md">
                  <span className="sr-only">Rival</span>
                  <select
                    value={equipo}
                    onChange={(evento) => setEquipoPedido(evento.target.value)}
                    className="w-full min-w-0 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-[#C8A96B]"
                  >
                    {!equipo && <option value="" className="bg-[#11161C]">Elige rival…</option>}
                    {equipos.map((nombre) => {
                      const suJornada = jornadaDeEquipo(orden, nombre);

                      return (
                        <option key={nombre} value={nombre} className="bg-[#11161C]">
                          {nombre}
                          {suJornada ? ` · ${suJornada.etiqueta}` : ""}
                          {esElProximo(orden, nombre) ? " · próximo" : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
                {/* La jornada (17/11/2026, ronda 21): nuestros partidos contra él; abre la lista del canal de ese partido. */}
                {equipo && jornadasDelRival.length > 0 && (
                  <label className="flex min-w-0 items-center gap-2">
                    <span className="sr-only">Jornada</span>
                    <select
                      value={jornada || ""}
                      onChange={(evento) => setJornadaPedida({ equipo, jornada: Number(evento.target.value) || 0 })}
                      className="min-w-0 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-[#C8A96B]"
                    >
                      {!jornada && <option value="" className="bg-[#11161C]">Jornada…</option>}
                      {jornadasDelRival.map((p) => (
                        <option key={p.jornada} value={p.jornada} className="bg-[#11161C]">
                          J{p.jornada}
                          {diaCorto(p.cuando) ? ` · ${diaCorto(p.cuando)}` : ""}
                          {p.jugado && p.golesFavor != null && p.golesContra != null ? ` · ${p.golesFavor}-${p.golesContra}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {equipo && esElProximo(orden, equipo) && (
                  <span className="rounded-full bg-[#C8A96B] px-1.5 py-px text-xs font-bold uppercase tracking-wider text-black">Próximo</span>
                )}
              </div>
            )}
          </section>

          {/*
          | ARRIBA, LA CONCLUSIÓN (17/11/2026, ronda 21): el titular y la
          | radiografía de percentiles del once probable. Las listas, debajo.
          */}
          {vista === "clips" && equipo && titulares.length > 0 && (
            <RadiografiaDelOnce className="mt-6" equipo={equipo} titulares={titulares} plantilla={plantilla} cortes={cortes} fuente={once.fuente} colocacion={colocacion} />
          )}

          {/* ---------------------------- VÍDEOS --------------------------- */}

          <div className="mt-6 min-w-0">
            {equipo ? (
              <VideosDelCanal
                /* Se remonta al cambiar de rival: la lista, los vídeos y el
                   buscador son otros, y arrastrar el estado del anterior
                   enseñaría un instante los cortes de quien no es. */
                key={equipo}
                equipo={equipo}
                plantilla={plantilla}
                visionados={vistasPorVideo}
                equipos={equipos}
                jugadorInicial={equipo === delEnlace ? jugadorEnlazado : ""}
                vista={vista === "lista" ? "lista" : "clips"}
                jornada={jornada || undefined}
                onReparto={alRepartir}
                onIrALista={() => setVista("lista")}
              />
            ) : (loading || !ordenListo) && !lento ? (
              <EsqueletoPantalla titulo="las plantillas rivales" cifras={0} paneles={1} />
            ) : loading || error ? null : (
              <EstadoVacio icon={Users} titulo="No hay plantillas rivales en la hoja todavía." />
            )}
          </div>

          {/*
          | CLIPS DE HUDL (17/11/2026, el analista): todas las listas
          | «RIVAL - JUGADOR» del rival, para bajarlas de una vez. Al final: cada
          | titular sin corte ya lleva los suyos en su tarjeta.
          */}
          {vista === "clips" && equipo && <ClipsHudlDelRival key={`hudl-${equipo}`} equipo={equipo} className="mt-6" />}
          </>
          )}
        </div>
      </main>
    </div>
  );
}
