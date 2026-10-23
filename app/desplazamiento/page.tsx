"use client";

/**
 * Desplazamiento de partido: el dossier del viaje y el horario del día.
 *
 * Sustituye a los dos documentos que se montaban a mano cada jornada y que
 * quedan en `public/` como referencia: `AWAY_TERUEL.pptx` —el campo y el
 * hotel, con sus planos y sus distancias— y `HORARIO_CD_TERUEL.pdf` —el día
 * entero en una columna de medias horas—. Son dos ficheros distintos que
 * cuentan el mismo viaje, así que aquí se rellenan **de una sola vez** y salen
 * los dos.
 *
 * Lo que hace que rellenarlo no dé pereza, que es de lo que iba el encargo:
 *
 * 1. **El partido se elige, no se escribe.** Rival, jornada, fecha, condición
 *    y dimensiones del campo salen del calendario y de la hoja RIVALES —la
 *    misma que leen el plan de partido y el informe del rival—, así que lo
 *    único que hay que teclear de verdad es la hora.
 * 2. **El horario se calcula desde esa hora.** Las plantillas montan el viaje
 *    entero —uno, dos o tres días— por desfases respecto al saque inicial; ver
 *    `EditorHorario`. Los días se añaden, se replican, se arrastran y se
 *    borran, y cada uno sale como una hoja A4 del horario.
 * 3. **Los planos se pegan.** Las capturas de Google Maps viven en el
 *    portapapeles, no en un fichero: `CampoImagen` acepta Ctrl+V.
 * 4. **Se ve mientras se escribe.** La vista previa es el documento de verdad,
 *    a escala, y es literalmente lo que sale al exportar: se captura ese mismo
 *    dibujo.
 * 5. **Se trae del anterior** lo que se repite: de dónde sale el autobús, los
 *    avisos y el reparto del día, reanclado a la nueva hora.
 *
 * El modelo vive en `lib/viaje/modelo.ts` y el dibujo en `components/viaje/`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Binoculars,
  Bus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock,
  Copy,
  Eye,
  Hotel,
  Landmark,
  Navigation,
  RotateCcw,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import {
  AbpHeader,
  Button,
  Dialog,
  Field,
  Notice,
  Panel,
  SaveState,
  TextArea,
} from "@/components/abp/ui";
import { CampoImagen } from "@/components/viaje/CampoImagen";
import { DossierViaje, titulosDossier } from "@/components/viaje/DossierViaje";
import { EditorHorario, type DiaCopiado } from "@/components/viaje/EditorHorario";
import { EntradaHora } from "@/components/viaje/EntradaHora";
import { ExportaViaje } from "@/components/viaje/ExportaViaje";
import { HojasHorario } from "@/components/viaje/HojaHorario";
import { NotasVestuario } from "@/components/viaje/NotasVestuario";
import { EscudoEquipo } from "@/components/rivals/EscudoEquipo";
import { useEscudos } from "@/hooks/useEscudos";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import {
  compareMatches,
  fetchMatches,
  formatMatchDate,
  matchLabel,
} from "@/lib/ratings/matches";
import type { MatchMeta } from "@/lib/ratings/types";
import {
  buscaJornada,
  cargaJornadas,
  enlaceAnalisisRival,
  enlacePlanDePartido,
  mezclaCalendario,
  type JornadaRival,
} from "@/lib/abp/jornada";
import {
  comoIso,
  DOSSIER_H,
  DOSSIER_W,
  EMPTY_VIAJE_STORE,
  HOJA_H,
  HOJA_W,
  COPIA_POR_DEFECTO,
  aHora,
  aMinutos,
  anclaDelHorario,
  comoDesfase,
  copiaViaje,
  diaCorto,
  diaLargo,
  diasEntre,
  mueveDiaPartido,
  mueveFechas,
  normalizaViaje,
  viajeVacio,
  type Desplazamiento,
  type QueCopiar,
  type ViajeStore,
} from "@/lib/viaje/modelo";
import { mismoEquipo } from "@/lib/data-analisis/nombres";
import { conSemilla, tieneSemilla } from "@/lib/viaje/semilla";
import { CALENDARIO_CASTILLA_KEY, enlaceRuta, horaDelCalendario, type PartidoBesoccer } from "@/lib/viaje/calendario";
import { barlowCondensed } from "@/lib/rivals/portada-font";
import { equipoDelInforme, type EquipoPortada } from "@/lib/portada/proximo-partido";

/** "J07 · 18 oct 2026 · @ Teruel", como se llama a la semana en la caseta. */
function etiquetaPartido(partido: MatchMeta, fechaReal?: string) {
  const numero = partido.competition.match(/^Jornada\s+(\d+)/i);

  const jornada = numero ? `J${numero[1].padStart(2, "0")} · ` : "";

  /* Manda la fecha del calendario de BeSoccer: la hoja RIVALES a veces va un día corrida. */
  const dia = formatMatchDate(fechaReal ? { ...partido, date: fechaReal } : partido);

  return `${jornada}${dia} · ${matchLabel(partido)}`;
}

/* ------------------------------------------------------------------ */
/*  VISTA PREVIA                                                       */
/* ------------------------------------------------------------------ */

/**
 * Encoge un lienzo de medida fija para que quepa en la columna.
 *
 * El documento se dibuja **siempre** a tamaño real —1920 px la diapositiva,
 * 1240 la hoja— y aquí sólo se escala. Así lo que se ve en pantalla y lo que
 * sale al exportar no pueden separarse: es el mismo dibujo.
 */
function Escalado({
  ancho,
  alto,
  children,
}: {
  ancho: number;
  alto: number;
  children: React.ReactNode;
}) {
  const marcoRef = useRef<HTMLDivElement>(null);

  const [escala, setEscala] = useState(0.4);

  useEffect(() => {
    const marco = marcoRef.current;

    if (!marco) return;

    const mide = () => setEscala(marco.clientWidth / ancho);

    mide();

    const observador = new ResizeObserver(mide);

    observador.observe(marco);

    return () => observador.disconnect();
  }, [ancho]);

  return (
    <div ref={marcoRef} className="w-full" style={{ height: alto * escala }}>
      <div
        style={{
          width: ancho,
          transform: `scale(${escala})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LO QUE FALTA                                                       */
/* ------------------------------------------------------------------ */

type Pendiente = { clave: string; rotulo: string; hecho: boolean; seccion: string };

/**
 * Lo que necesita el viaje para salir completo, en el orden del formulario
 * (19/10/2026): el formulario es largo y no se veía de un golpe qué quedaba.
 * Cada chapa lleva a su sección.
 */
function pendientesDe(viaje: Desplazamiento): Pendiente[] {
  const lista: Pendiente[] = [
    { clave: "hora", rotulo: "Hora del partido", hecho: Boolean(viaje.hora), seccion: "viaje-partido" },
    { clave: "estadio", rotulo: "Estadio", hecho: Boolean(viaje.estadio.nombre.trim()), seccion: "viaje-estadio" },
    { clave: "direccion", rotulo: "Dirección del estadio", hecho: Boolean(viaje.estadio.direccion.trim()), seccion: "viaje-estadio" },
    { clave: "plano", rotulo: "Plano del estadio", hecho: Boolean(viaje.estadio.plano?.url), seccion: "viaje-estadio" },
    { clave: "ruta", rotulo: "Ruta del autobús", hecho: Boolean(viaje.estadio.ruta?.url), seccion: "viaje-estadio" },
  ];

  if (viaje.conHotel) {
    lista.push(
      { clave: "hotel", rotulo: "Hotel", hecho: Boolean(viaje.hotel.nombre.trim()), seccion: "viaje-hotel" },
      { clave: "foto", rotulo: "Foto del hotel", hecho: Boolean(viaje.hotel.foto?.url), seccion: "viaje-hotel" },
      { clave: "ruta-hotel", rotulo: "Ruta hotel · estadio", hecho: Boolean(viaje.hotel.ruta?.url), seccion: "viaje-hotel" },
    );
  }

  lista.push(
    { clave: "horario", rotulo: "Horario", hecho: viaje.dias.some((dia) => dia.citas.length > 0), seccion: "viaje-horario" },
    { clave: "avisos", rotulo: "No olvidar", hecho: viaje.avisos.some((a) => a.trim()), seccion: "viaje-avisos" },
  );

  return lista;
}

const irA = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

function ListaPendiente({ viaje }: { viaje: Desplazamiento }) {
  const lista = pendientesDe(viaje);
  const hechos = lista.filter((p) => p.hecho).length;
  const completo = hechos === lista.length;

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Cómo va el viaje</p>

        <div className="h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-white/10 sm:max-w-[220px]" aria-hidden>
          <div className="h-full rounded-full bg-[#C8A96B] transition-all" style={{ width: `${(hechos / lista.length) * 100}%` }} />
        </div>

        <p className="text-xs tabular-nums text-white/60">
          {completo ? "Todo listo para exportar" : `${hechos} de ${lista.length}`}
        </p>

        <button type="button" onClick={() => irA("viaje-vista")} className="ml-auto flex items-center gap-1 text-xs text-[#C8A96B] hover:underline">
          <Eye size={13} /> Vista previa y exportar
        </button>
      </div>

      {!completo && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lista.map((p) => (
            <button
              key={p.clave}
              type="button"
              onClick={() => irA(p.seccion)}
              title={p.hecho ? "Hecho" : "Falta: ir a la sección"}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
                p.hecho ? "border-white/10 text-white/35" : "border-[#C8A96B]/40 text-white/80 hover:bg-[#C8A96B]/10"
              }`}
            >
              {p.hecho ? <CheckCircle2 size={12} className="text-emerald-400/70" /> : <Circle size={12} className="text-[#C8A96B]" />}
              {p.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Un enlace a la ruta en Google Maps, al lado de los campos de distancia y tiempo. */
function EnlaceRuta({ desde, hasta, rotulo }: { desde: string; hasta: string; rotulo: string }) {
  const url = enlaceRuta(desde, hasta);

  if (!url) return null;

  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#C8A96B] hover:underline">
      <Navigation size={12} /> {rotulo}
    </a>
  );
}

/* ------------------------------------------------------------------ */
/*  LA PÁGINA                                                          */
/* ------------------------------------------------------------------ */

export default function DesplazamientoPage() {
  /* El escudo del club, que la hoja no trae: ver `hooks/useEscudos`. */
  const escudoDe = useEscudos();

  const {
    value: store,
    setValue: setStore,
    status,
    localOnly,
    lastSavedAt,
  } = useRemoteDoc<ViajeStore>({
    key: "desplazamientos",
    kind: "operativa",
    fallback: EMPTY_VIAJE_STORE,
  });

  /* --------------------------- CALENDARIO -------------------------- */

  /** El partido que se está mirando, cuando alguien lo ha elegido a mano. */
  const [pedido, setPedido] = useState("");

  const [jugados, setJugados] = useState<MatchMeta[]>([]);
  const [jornadas, setJornadas] = useState<JornadaRival[]>([]);
  const [cargando, setCargando] = useState(true);

  /*
  | Las dos fuentes se piden a la vez y **fallan por separado**, como en la
  | pizarra de balón parado: el CSV sólo tiene lo jugado, así que la jornada
  | que viene —la que se está preparando— sale de la hoja RIVALES, y con
  | cualquiera de las dos se puede trabajar.
  */
  useEffect(() => {
    const control = new AbortController();

    const carga = async () => {
      const [csv, hoja] = await Promise.all([
        fetchMatches(control.signal).catch((error) => {
          if (!control.signal.aborted) {
            console.error("[desplazamiento] calendario", error);
          }

          return [] as MatchMeta[];
        }),
        cargaJornadas(control.signal).catch((error) => {
          if (!control.signal.aborted) {
            console.error("[desplazamiento] hoja RIVALES", error);
          }

          return [] as JornadaRival[];
        }),
      ]);

      if (control.signal.aborted) return;

      setJugados([...csv].sort(compareMatches));
      setJornadas(hoja);
      setCargando(false);

      /* Llegada desde el plan de partido: /desplazamiento?rival=<ID>. */
      const pedidoUrl = new URLSearchParams(window.location.search).get("rival");

      if (!pedidoUrl) return;

      const fila = hoja.find((item) => item.id === pedidoUrl);

      if (!fila) return;

      const calendario = mezclaCalendario(csv, hoja);

      const destino =
        (fila.fecha
          ? calendario.find((item) => item.date === fila.fecha)
          : undefined) ?? calendario.find((item) => item.opponent === fila.equipo);

      if (destino) setPedido(destino.id);

      window.history.replaceState({}, "", "/desplazamiento");
    };

    void carga();

    return () => control.abort();
  }, []);

  /* El calendario de BeSoccer, con la HORA de cada partido (19/10/2026): ver `lib/viaje/calendario.ts`. */
  const [besoccer, setBesoccer] = useState<PartidoBesoccer[] | null>(null);

  useEffect(() => {
    let vivo = true;

    fetch(`/api/docs?key=${encodeURIComponent(CALENDARIO_CASTILLA_KEY)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ data?: { partidos?: PartidoBesoccer[] } | null }>) : null))
      .then((d) => {
        if (vivo) setBesoccer(d?.data?.partidos ?? []);
      })
      .catch(() => {
        if (vivo) setBesoccer([]);
      });

    return () => {
      vivo = false;
    };
  }, []);

  /* El estadio y la ciudad del rival, de su informe (los mismos que enseña la portada). */
  const [equiposInforme, setEquiposInforme] = useState<EquipoPortada[]>([]);

  useEffect(() => {
    let vivo = true;

    fetch("/api/data-analisis?portada=1")
      .then((r) => (r.ok ? (r.json() as Promise<{ equipos?: EquipoPortada[] }>) : null))
      .then((d) => {
        if (vivo) setEquiposInforme(d?.equipos ?? []);
      })
      .catch(() => {
        if (vivo) setEquiposInforme([]);
      });

    return () => {
      vivo = false;
    };
  }, []);

  const partidos = useMemo(
    () => mezclaCalendario(jugados, jornadas),
    [jugados, jornadas],
  );

  /* Fecha de cada partido según BeSoccer (hora de Madrid), para el selector. */
  const fechaBesoccer = useMemo(() => {
    const mapa = new Map<string, string>();

    for (const item of partidos) {
      const hallado = horaDelCalendario(besoccer, {
        fecha: item.date,
        rival: item.opponent,
        jornada: Number(item.competition.match(/^Jornada\s+(\d+)/i)?.[1]) || null,
      });

      if (hallado?.fecha) mapa.set(item.id, hallado.fecha);
    }

    return mapa;
  }, [besoccer, partidos]);

  /* «Hoy», una vez al montar (en hora local, como todo `lib/viaje`: en UTC, a
     las 00:30 de un domingo español el «hoy» era el sábado). */
  const [hoy] = useState(() => comoIso(new Date()));

  /*
  | Al entrar manda el PRÓXIMO partido: preparar un viaje es tarea de la
  | semana de antes. Antes mandaba el último viaje tocado, y en cuanto se
  | montaba uno la pantalla seguía abriendo ese partido ya jugado (19/10/2026).
  | Si la temporada se ha acabado, el último con viaje.
  */
  const porDefecto = useMemo(() => {
    if (partidos.length === 0) return "";

    const proximo = partidos.find((item) => item.date && item.date >= hoy);

    if (proximo) return proximo.id;

    const conViaje = partidos.filter((item) => store.viajes?.[item.id]);

    return (conViaje[conViaje.length - 1] ?? partidos[partidos.length - 1]).id;
  }, [partidos, store.viajes, hoy]);

  const elegido = pedido || porDefecto;

  const indiceElegido = partidos.findIndex((item) => item.id === elegido);

  const proximoId = useMemo(() => partidos.find((item) => item.date && item.date >= hoy)?.id ?? "", [partidos, hoy]);

  /* El selector enseña las 5 próximas jornadas (y la que se esté mirando); las demás, bajo «Ver todas». */
  const [verTodas, setVerTodas] = useState(false);

  const visibles = useMemo(() => {
    if (verTodas || !proximoId) return partidos;

    const desde = partidos.findIndex((item) => item.id === proximoId);
    const cinco = new Set(partidos.slice(desde, desde + 5).map((item) => item.id));

    if (elegido) cinco.add(elegido);

    return partidos.filter((item) => cinco.has(item.id));
  }, [partidos, proximoId, verTodas, elegido]);

  const partido = useMemo(
    () => partidos.find((item) => item.id === elegido) ?? null,
    [partidos, elegido],
  );

  /* La fila de la hoja: de ahí salen las dimensiones del campo y los enlaces. */
  const jornada = useMemo(() => {
    if (!partido) return null;

    return buscaJornada(jornadas, {
      rival: partido.opponent,
      fecha: partido.date,
    });
  }, [jornadas, partido]);

  /* Lo que dice BeSoccer de este partido: fecha, hora y jornada. */
  const delCalendario = useMemo(
    () =>
      partido
        ? horaDelCalendario(besoccer, {
            fecha: partido.date,
            rival: partido.opponent,
            jornada: Number(partido.competition.match(/^Jornada\s+(\d+)/i)?.[1]) || null,
          })
        : null,
    [besoccer, partido],
  );

  /* ---------------------------- EL VIAJE --------------------------- */

  /**
   * El desplazamiento del partido elegido.
   *
   * Se **deriva** en lugar de guardarse al abrir: crear el documento en un
   * efecto llenaría el almacén de viajes vacíos con sólo pasar por la lista de
   * partidos. Existe de verdad en cuanto alguien escribe algo.
   */
  const viaje: Desplazamiento | null = useMemo(() => {
    if (!partido) return null;

    const guardado = store.viajes?.[partido.id];

    /* Los desplazamientos guardados cuando el viaje era un solo día llevan
       `horario` y no `dias`: se convierten al leerlos. */
    if (guardado) return normalizaViaje(guardado);

    /* Con la hora del calendario el viaje abre montado a su hora (antes, a las 20:00 hasta que alguien la tecleaba). */
    const base = viajeVacio(partido.id, {
      rival: partido.opponent,
      jornada: jornada?.jornada || (delCalendario ? String(delCalendario.jornada) : ""),
      rivalId: jornada?.id,
      /* BeSoccer manda en la fecha: la hoja RIVALES ponía el Ibiza el 11 y se jugó el 9. */
      fecha: delCalendario?.fecha || partido.date || "",
      hora: delCalendario?.hora ?? "",
      condicion: partido.isHome ? "local" : "visitante",
      competicion: partido.competition,
    });

    /* La hoja RIVALES trae las dimensiones del campo del rival: es el único
       dato del dossier que ya está escrito en algún sitio. */
    const delRival =
      base.condicion === "visitante"
        ? equipoDelInforme(equiposInforme, partido.opponent) ?? equipoDelInforme(equiposInforme, jornada?.equipo ?? "")
        : null;

    const conCampo = delRival?.estadio
      ? { ...base, estadio: { ...base.estadio, nombre: delRival.estadio, ciudad: delRival.ciudad || base.estadio.ciudad } }
      : base;

    const conDimensiones = jornada?.fila?.DIMENSIONES
      ? {
          ...conCampo,
          estadio: { ...conCampo.estadio, dimensiones: jornada.fila.DIMENSIONES },
        }
      : conCampo;

    /* Y la jornada 1 viene montada entera desde los documentos originales. */
    return conSemilla(conDimensiones);
  }, [partido, store.viajes, jornada, delCalendario, equiposInforme]);

  const guardado = Boolean(partido && store.viajes?.[partido.id]);

  const muta = useCallback(
    (fn: (actual: Desplazamiento) => Desplazamiento) => {
      if (!partido || !viaje) return;

      setStore((actual) => ({
        ...actual,
        viajes: {
          ...actual.viajes,
          [partido.id]: {
            /* Se normaliza antes de tocarlo: así el primer cambio sobre un
               documento viejo lo deja ya convertido a días. */
            ...fn(
              actual.viajes?.[partido.id]
                ? normalizaViaje(actual.viajes[partido.id])
                : viaje,
            ),
            actualizado: new Date().toISOString(),
          },
        },
      }));
    },
    [partido, setStore, viaje],
  );

  const campo = useCallback(
    <K extends keyof Desplazamiento>(clave: K, valor: Desplazamiento[K]) =>
      muta((actual) => ({ ...actual, [clave]: valor })),
    [muta],
  );

  const estadio = useCallback(
    (parche: Partial<Desplazamiento["estadio"]>) =>
      muta((actual) => ({ ...actual, estadio: { ...actual.estadio, ...parche } })),
    [muta],
  );

  const hotel = useCallback(
    (parche: Partial<Desplazamiento["hotel"]>) =>
      muta((actual) => ({ ...actual, hotel: { ...actual.hotel, ...parche } })),
    [muta],
  );

  /** El último partido anterior a éste que ya tenga desplazamiento montado. */
  const anterior = useMemo(() => {
    if (!partido) return null;

    const indice = partidos.findIndex((item) => item.id === partido.id);

    for (let i = indice - 1; i >= 0; i -= 1) {
      if (store.viajes?.[partidos[i].id]) return partidos[i];
    }

    return null;
  }, [partido, partidos, store.viajes]);

  /* ------------------------ COPIAR DE OTRO VIAJE ------------------- */

  /*
  | Cualquier viaje montado sirve de punto de partida, no sólo el anterior:
  | el de la jornada con el mismo horario, el de la ida contra este mismo
  | rival —mismo estadio, mismo hotel—, el de la última vez que se durmió
  | fuera. Se elige cuál y qué se trae.
  */
  const otrosViajes = useMemo(() => {
    if (!partido || !viaje) return [];

    return Object.entries(store.viajes ?? {})
      .filter(([id]) => id !== partido.id)
      .map(([id, guardadoAhi]) => {
        const suyo = normalizaViaje(guardadoAhi);

        const delCalendario = partidos.find((item) => item.id === id);

        return {
          id,
          etiqueta: delCalendario
            ? etiquetaPartido(delCalendario, fechaBesoccer.get(id))
            : `${suyo.rival || "Sin rival"} · ${suyo.fecha || "sin fecha"}`,
          fecha: suyo.fecha,
          dias: suyo.dias.length,
          citas: suyo.dias.reduce((suma, dia) => suma + dia.citas.length, 0),
          mismoRival:
            Boolean(suyo.rivalId && suyo.rivalId === viaje.rivalId) ||
            Boolean(suyo.rival && viaje.rival && mismoEquipo(suyo.rival, viaje.rival)),
        };
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [partido, partidos, store.viajes, viaje, fechaBesoccer]);

  const [copiando, setCopiando] = useState(false);
  const [fuenteCopia, setFuenteCopia] = useState("");
  const [queCopiar, setQueCopiar] = useState<QueCopiar>(COPIA_POR_DEFECTO);

  /* Estadio y hotel sólo se proponen si es el mismo rival: si no, mandarían al
     equipo a la ciudad equivocada. */
  const eligeFuente = (id: string) => {
    const uno = otrosViajes.find((item) => item.id === id);

    setFuenteCopia(id);

    setQueCopiar({
      horario: true,
      rutina: true,
      estadio: Boolean(uno?.mismoRival),
      hotel: Boolean(uno?.mismoRival),
    });
  };

  const abreCopia = () => {
    const propuesta =
      otrosViajes.find((item) => item.mismoRival)?.id ??
      (anterior && otrosViajes.some((item) => item.id === anterior.id)
        ? anterior.id
        : otrosViajes[0]?.id) ??
      "";

    eligeFuente(propuesta);

    setCopiando(true);
  };

  const confirmaCopia = () => {
    if (!partido || !viaje) return;

    const fuente = store.viajes?.[fuenteCopia];

    if (!fuente) return;

    /* Lo de antes, para poder volver atrás desde el aviso. */
    const previo = store.viajes?.[partido.id];
    const id = partido.id;

    /* El horario se reancla a la fecha del partido de destino: sin ella, se
       quedaría con las del de origen, así que no se copia y se dice. */
    const sinFecha = queCopiar.horario && !viaje.fecha;

    muta((actual) => copiaViaje(fuente, actual, queCopiar));

    setCopiando(false);

    if (sinFecha) {
      toast.warning("El horario no se ha copiado", {
        description:
          "Este partido todavía no tiene fecha, y sin ella los días se quedarían con las del otro viaje. Pon la fecha y vuelve a copiar.",
      });
    }

    const partes = [
      queCopiar.horario && "el horario",
      queCopiar.rutina && "la salida y los avisos",
      queCopiar.estadio && "el estadio",
      queCopiar.hotel && "el hotel",
    ].filter(Boolean);

    const de = otrosViajes.find((item) => item.id === fuenteCopia)?.etiqueta ?? "otro viaje";

    toast.success(`Copiado de ${de}: ${partes.join(", ")}`, {
      description: queCopiar.horario
        ? "El día del partido va reanclado a la hora de este partido; los demás días, a su hora."
        : undefined,
      duration: 10000,
      action: {
        label: "Deshacer",
        onClick: () =>
          setStore((actual) => {
            const viajes = { ...actual.viajes };

            if (previo) viajes[id] = previo;
            else delete viajes[id];

            return { ...actual, viajes };
          }),
      },
    });
  };

  /* ---------------------- HORA Y FECHA DEL PARTIDO ------------------ */

  /*
  | Cambiar la hora del partido mueve el día del partido.
  |
  | Es lo que prometía la pantalla y no hacía: se escribía la hora y el
  | horario se quedaba donde estaba —en un viaje recién abierto, montado para
  | las 20:00—. Se mueve desde la hora a la que ESTÁ montado el día (la cita
  | «Partido»), así que la comida, la charla y el calentamiento quedan a la
  | misma distancia del saque inicial. Los demás días van por reloj.
  */
  const cambiaHora = useCallback(
    (minuto: number | null) => {
      if (!viaje) return;

      const antes = anclaDelHorario(viaje);

      muta((actual) => {
        const ancla = anclaDelHorario(actual);

        const salto = minuto !== null && ancla !== null ? minuto - ancla : 0;

        return {
          ...actual,
          hora: minuto === null ? "" : aHora(minuto),
          dias: salto ? mueveDiaPartido(actual, salto) : actual.dias,
        };
      });

      if (minuto !== null && antes !== null && minuto !== antes) {
        toast.success(
          `El día del partido se mueve ${comoDesfase(minuto - antes)}`,
          {
            description:
              "Todo sigue a la misma distancia del saque inicial. Los demás días no se tocan.",
          },
        );
      }
    },
    [muta, viaje],
  );

  /* Y cambiar la fecha lleva todo el viaje con ella: la víspera sigue siendo la víspera. */
  const cambiaFecha = useCallback(
    (fecha: string) => {
      if (!viaje) return;

      const salto = viaje.fecha && fecha ? diasEntre(viaje.fecha, fecha) : 0;

      muta((actual) => ({
        ...actual,
        fecha,
        dias: mueveFechas(
          actual.dias,
          actual.fecha && fecha ? diasEntre(actual.fecha, fecha) : 0,
        ),
      }));

      if (salto && viaje.dias.length) {
        toast.success(
          `Los ${viaje.dias.length} días del viaje se mueven con el partido (${
            salto > 0 ? "+" : "−"
          }${Math.abs(salto)} ${Math.abs(salto) === 1 ? "día" : "días"})`,
        );
      }
    },
    [muta, viaje],
  );

  /* Lo copiado de un día: aquí arriba para poder pegarlo en otro viaje. */
  const [diaCopiado, setDiaCopiado] = useState<DiaCopiado | null>(null);

  /* ----------------------------- VISTA ----------------------------- */

  const [vista, setVista] = useState<"dossier" | "horario">("dossier");

  const carpeta = `desplazamientos/${partido?.id ?? "suelto"}`;

  return (
    <main
      className={`min-h-screen bg-[#0B0F14] text-white ${barlowCondensed.className}`}
      style={
        {
          "--fuente-viaje": barlowCondensed.style.fontFamily,
        } as React.CSSProperties
      }
    >
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Operativa"
              title="Desplazamiento de Partido"
              lead="El dossier del viaje —campo, ruta y hotel— y el horario de cada día, rellenados de una vez y sacados en PowerPoint o en PDF para imprimir. El viaje puede durar uno, dos o más días: el horario se monta solo desde la hora del partido y sale una hoja por día."
              aside={
                <SaveState
                  status={status}
                  localOnly={localOnly}
                  savedAt={lastSavedAt}
                />
              }
            />

            {/* ===================== PARTIDO ===================== */}

            <div className="mt-6 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="block min-w-0">
                <span id="etiqueta-partido" className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Partido
                </span>

                <span className="flex min-w-0 items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Partido anterior"
                  disabled={indiceElegido <= 0}
                  onClick={() => setPedido(partidos[indiceElegido - 1]?.id ?? elegido)}
                  className="shrink-0 rounded-xl border border-white/10 px-2.5 py-2 text-white/60 transition hover:text-white disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>

                <select
                  aria-labelledby="etiqueta-partido"
                  value={elegido}
                  onChange={(evento) => {
                    if (evento.target.value === "__todas") setVerTodas(true);
                    else setPedido(evento.target.value);
                  }}
                  className="w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
                >
                  {partidos.length === 0 && (
                    <option value="">
                      {cargando ? "Cargando calendario…" : "Sin partidos"}
                    </option>
                  )}

                  {visibles.map((item) => (
                    <option key={item.id} value={item.id} className="bg-[#11161C]">
                      {etiquetaPartido(item, fechaBesoccer.get(item.id))}
                      {store.viajes?.[item.id] ? " ✓" : ""}
                      {item.id === proximoId ? " · próximo" : ""}
                    </option>
                  ))}

                  {!verTodas && visibles.length < partidos.length && (
                    <option value="__todas" className="bg-[#11161C]">
                      Ver todas las jornadas…
                    </option>
                  )}
                </select>

                <button
                  type="button"
                  aria-label="Partido siguiente"
                  disabled={indiceElegido < 0 || indiceElegido >= partidos.length - 1}
                  onClick={() => setPedido(partidos[indiceElegido + 1]?.id ?? elegido)}
                  className="shrink-0 rounded-xl border border-white/10 px-2.5 py-2 text-white/60 transition hover:text-white disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>

                {proximoId && proximoId !== elegido && (
                  <button
                    type="button"
                    onClick={() => setPedido(proximoId)}
                    className="shrink-0 rounded-xl border border-[#C8A96B]/40 px-3 py-2 text-xs text-[#C8A96B] transition hover:bg-[#C8A96B]/10"
                  >
                    Próximo
                  </button>
                )}
                </span>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                {viaje && otrosViajes.length > 0 && (
                  <Button
                    icon={Copy}
                    onClick={abreCopia}
                    title="Traer el horario, los avisos, el estadio o el hotel de cualquier otro viaje ya montado"
                  >
                    Copiar de otro viaje
                  </Button>
                )}

                {jornada && (
                  <>
                    <Link href={enlacePlanDePartido(jornada)}>
                      <Button icon={ClipboardList}>Plan de partido</Button>
                    </Link>

                    <Link href={enlaceAnalisisRival(jornada)}>
                      <Button icon={Binoculars}>Informe del rival</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>

            {!partido ? (
              <div className="mt-6">
                <Notice
                  tone="warn"
                  title={cargando ? "Cargando el calendario…" : "Sin partidos"}
                >
                  {cargando
                    ? "El calendario de partidos y la hoja RIVALES tardan un momento."
                    : "No hay ningún partido en el calendario ni en la hoja RIVALES."}
                </Notice>
              </div>
            ) : (
              viaje && (
                <>
                  {!guardado && (
                    <div className="mt-4">
                      {tieneSemilla(viaje) ? (
                        <Notice title="Viene relleno de fábrica">
                          Este desplazamiento sale montado con los textos, los
                          planos y el horario de los documentos originales
                          (AWAY_TERUEL.pptx y HORARIO_CD_TERUEL.pdf). Cámbialo a
                          gusto: en cuanto escribas algo se guarda solo y manda
                          lo escrito.
                        </Notice>
                      ) : (
                        <Notice title="Cambia los días; se guarda solo">
                          Parte de los datos del calendario y de un viaje propuesto:{" "}
                          {viaje.condicion === "visitante"
                            ? "dos días —la víspera y el partido—, que es lo que se hace casi todas las jornadas fuera de casa"
                            : "un día, el del partido"}
                          . Cámbialo a gusto —se añaden y se quitan días— y en
                          cuanto escribas algo se guarda solo.
                        </Notice>
                      )}
                    </div>
                  )}

                  <ListaPendiente viaje={viaje} />

                  {/* La hora guardada no es la del calendario (o no hay): se propone, no se cambia sola. */}
                  {guardado && delCalendario?.hora && (delCalendario.hora !== viaje.hora || (delCalendario.fecha && delCalendario.fecha !== viaje.fecha)) && (() => {
                    const otraFecha = Boolean(delCalendario.fecha && delCalendario.fecha !== viaje.fecha);
                    const cuando = `${otraFecha ? `${diaLargo(delCalendario.fecha).toLowerCase()} a las ` : ""}${delCalendario.hora}`;

                    return (
                      <div className="mt-3">
                        <Notice tone="warn" title={viaje.hora || otraFecha ? `El calendario dice ${cuando}` : `El calendario ya tiene la hora: ${delCalendario.hora}`}>
                          <span className="flex flex-wrap items-center gap-2">
                            <span>
                              Sale del calendario de BeSoccer
                              {viaje.hora || viaje.fecha ? ` (aquí: ${[viaje.fecha ? diaLargo(viaje.fecha).toLowerCase() : "", viaje.hora].filter(Boolean).join(" a las ")})` : ""}. Al usarlo, los días del viaje se mueven con el partido.
                            </span>
                            <Button
                              icon={Clock}
                              onClick={() => {
                                if (otraFecha) cambiaFecha(delCalendario.fecha);
                                cambiaHora(aMinutos(delCalendario.hora));
                              }}
                            >
                              Usar {otraFecha ? `${diaCorto(delCalendario.fecha).toLowerCase()} · ` : ""}{delCalendario.hora}
                            </Button>
                          </span>
                        </Notice>
                      </div>
                    );
                  })()}

                  {/* ================== EL PARTIDO ================== */}

                  <div className="mt-5 scroll-mt-20" id="viaje-partido">
                    <Panel
                      title="El partido"
                      subtitle="La cabecera que llevan las tres diapositivas y la hoja del horario"
                      icon={Shield}
                      action={
                        /* A quién se viaja, con su escudo: el desplegable de
                           arriba es un <select> nativo y no puede llevarlo. */
                        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white/70">
                          <EscudoEquipo
                            nombre={viaje.rival || partido.opponent}
                            escudo={escudoDe(viaje.rival || partido.opponent)}
                            lado={26}
                          />

                          <span className="truncate">
                            {viaje.rival || partido.opponent}
                          </span>
                        </span>
                      }
                    >
                      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Field
                          label="Rival"
                          value={viaje.rival}
                          onChange={(valor) => campo("rival", valor)}
                          placeholder={partido.opponent}
                          hint="Como se quiere leer: la hoja dice el nombre oficial y en la caseta se dice el corto."
                        />

                        <Field
                          label="Jornada"
                          value={viaje.jornada}
                          onChange={(valor) => campo("jornada", valor)}
                          placeholder="1"
                        />

                        <label className="block min-w-0">
                          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                            Fecha
                          </span>

                          <input
                            type="date"
                            value={viaje.fecha}
                            onChange={(evento) => cambiaFecha(evento.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm tabular-nums text-white outline-none transition [color-scheme:dark] focus:border-[#C8A96B]/50"
                          />

                          <span className="mt-1 block text-[11px] leading-snug text-white/35">
                            Si cambia, los días del viaje se mueven con ella.
                          </span>
                        </label>

                        <label className="block min-w-0">
                          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                            Hora del partido
                          </span>

                          <EntradaHora
                            minuto={aMinutos(viaje.hora)}
                            onCambia={cambiaHora}
                            permiteVacio
                            placeholder="21:15"
                            etiqueta="Hora del partido"
                            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm tabular-nums text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
                          />

                          <span className="mt-1 block text-[11px] leading-snug text-white/35">
                            {delCalendario?.hora && delCalendario.hora === viaje.hora
                              ? "La del calendario de BeSoccer. Al cambiarla, el día del partido se mueve solo."
                              : "La que manda: al cambiarla, el día del partido se mueve solo."}
                          </span>
                        </label>
                      </div>

                      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="block min-w-0">
                          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                            Dónde se juega
                          </span>

                          <select
                            value={viaje.condicion}
                            onChange={(evento) =>
                              campo(
                                "condicion",
                                evento.target.value as "local" | "visitante",
                              )
                            }
                            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
                          >
                            <option value="visitante" className="bg-[#11161C]">
                              Fuera
                            </option>
                            <option value="local" className="bg-[#11161C]">
                              En casa
                            </option>
                          </select>
                        </label>

                        <Field
                          label="Competición"
                          value={viaje.competicion}
                          onChange={(valor) => campo("competicion", valor)}
                          placeholder={partido.competition}
                        />

                        <Field
                          label="Sale de"
                          value={viaje.origen}
                          onChange={(valor) => campo("origen", valor)}
                          placeholder="Valdebebas"
                        />

                        <label className="flex min-w-0 items-center gap-2 self-end rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={viaje.conHotel}
                            onChange={(evento) =>
                              campo("conHotel", evento.target.checked)
                            }
                            className="h-4 w-4 accent-[#C8A96B]"
                          />

                          <span className="text-xs text-white/70">
                            El viaje lleva hotel
                          </span>
                        </label>
                      </div>

                      {viaje.rival.trim() !== partido.opponent.trim() && (
                        <div className="mt-3">
                          <Button
                            icon={RotateCcw}
                            onClick={() => campo("rival", partido.opponent)}
                          >
                            Usar el nombre del calendario
                          </Button>
                        </div>
                      )}
                    </Panel>
                  </div>

                  {/* ================== EL ESTADIO ================= */}

                  <div className="mt-5 scroll-mt-20" id="viaje-estadio">
                    <Panel
                      title="El estadio"
                      subtitle="Dónde se juega y cómo se llega: la diapositiva del campo"
                      icon={Landmark}
                    >
                      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Field
                          label="Nombre"
                          value={viaje.estadio.nombre}
                          onChange={(valor) => estadio({ nombre: valor })}
                          placeholder="Nombre del estadio"
                        />

                        <Field
                          label="Ciudad"
                          value={viaje.estadio.ciudad}
                          onChange={(valor) => estadio({ ciudad: valor })}
                          placeholder={
                            /* Sin la ciudad en el informe del rival, se sugiere su nombre corto (la hoja no la trae). */
                            equipoDelInforme(equiposInforme, viaje.rival || partido.opponent)?.nombre || "Ciudad del estadio"
                          }
                        />

                        <Field
                          label="Superficie"
                          value={viaje.estadio.superficie}
                          onChange={(valor) => estadio({ superficie: valor })}
                          placeholder="Natural o artificial"
                        />

                        <Field
                          label="Dimensiones"
                          value={viaje.estadio.dimensiones}
                          onChange={(valor) => estadio({ dimensiones: valor })}
                          placeholder="105 × 68"
                          hint={
                            jornada?.fila?.DIMENSIONES
                              ? "Viene de la hoja RIVALES."
                              : undefined
                          }
                        />
                      </div>

                      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Field
                          label="Dirección"
                          value={viaje.estadio.direccion}
                          onChange={(valor) => estadio({ direccion: valor })}
                          placeholder="Calle, número y ciudad"
                        />

                        <Field
                          label="Distancia"
                          value={viaje.estadio.distancia}
                          onChange={(valor) => estadio({ distancia: valor })}
                          placeholder="Kilómetros"
                        />

                        <Field
                          label="Tiempo de viaje"
                          value={viaje.estadio.tiempo}
                          onChange={(valor) => estadio({ tiempo: valor })}
                          placeholder="Horas y minutos"
                        />

                        <Field
                          label="Enlace del mapa"
                          value={viaje.estadio.enlace}
                          onChange={(valor) => estadio({ enlace: valor })}
                          placeholder="https://maps.app.goo.gl/…"
                        />
                      </div>

                      {/* La ruta abierta en Google Maps: de ahí salen la distancia, el tiempo y la captura (19/10/2026). */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <EnlaceRuta
                          desde={viaje.origen || "Ciudad Real Madrid, Valdebebas"}
                          hasta={viaje.estadio.direccion || [viaje.estadio.nombre, viaje.estadio.ciudad].filter(Boolean).join(", ")}
                          rotulo={`Ruta ${viaje.origen || "Valdebebas"} · estadio en Google Maps`}
                        />

                        {viaje.estadio.enlace.trim() && /^https?:\/\//i.test(viaje.estadio.enlace.trim()) && (
                          <a href={viaje.estadio.enlace.trim()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#C8A96B] hover:underline">
                            <Landmark size={12} /> Abrir el mapa del estadio
                          </a>
                        )}
                      </div>

                      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                        <CampoImagen
                          etiqueta="Plano del estadio"
                          ayuda="Pie: «Nombre del estadio · acceso autobús»"
                          carpeta={carpeta}
                          imagen={viaje.estadio.plano}
                          onCambio={(imagen) => estadio({ plano: imagen })}
                        />

                        <CampoImagen
                          etiqueta="Ruta del autobús"
                          ayuda="Pie: «Valdebebas · ciudad del estadio, kilómetros»"
                          carpeta={carpeta}
                          imagen={viaje.estadio.ruta}
                          onCambio={(imagen) => estadio({ ruta: imagen })}
                        />
                      </div>
                    </Panel>
                  </div>

                  {/* =================== EL HOTEL ================== */}

                  {viaje.conHotel && (
                    <div className="mt-5 scroll-mt-20" id="viaje-hotel">
                      <Panel
                        title="El hotel"
                        subtitle="Dónde se come y se descansa, y a cuánto queda del campo"
                        icon={Hotel}
                      >
                        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <Field
                            label="Nombre"
                            value={viaje.hotel.nombre}
                            onChange={(valor) => hotel({ nombre: valor })}
                            placeholder="Nombre del hotel"
                          />

                          <Field
                            label="Dirección"
                            value={viaje.hotel.direccion}
                            onChange={(valor) => hotel({ direccion: valor })}
                            placeholder="Calle, número y ciudad"
                          />

                          <Field
                            label="Teléfono"
                            value={viaje.hotel.telefono}
                            onChange={(valor) => hotel({ telefono: valor })}
                            placeholder="Teléfono de recepción"
                          />

                          <Field
                            label="Entrada"
                            value={viaje.hotel.entrada}
                            onChange={(valor) => hotel({ entrada: valor })}
                            placeholder="Día y hora de entrada"
                          />
                        </div>

                        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <Field
                            label="Distancia al campo"
                            value={viaje.hotel.distancia}
                            onChange={(valor) => hotel({ distancia: valor })}
                            placeholder="Kilómetros al estadio"
                          />

                          <Field
                            label="Tiempo al campo"
                            value={viaje.hotel.tiempo}
                            onChange={(valor) => hotel({ tiempo: valor })}
                            placeholder="Minutos al estadio"
                          />

                          <Field
                            label="Enlace de la reserva"
                            value={viaje.hotel.enlace}
                            onChange={(valor) => hotel({ enlace: valor })}
                            placeholder="https://…"
                          />
                        </div>

                        <div className="mt-2">
                          <EnlaceRuta
                            desde={viaje.hotel.direccion || viaje.hotel.nombre}
                            hasta={viaje.estadio.direccion || [viaje.estadio.nombre, viaje.estadio.ciudad].filter(Boolean).join(", ")}
                            rotulo="Ruta hotel · estadio en Google Maps"
                          />
                        </div>

                        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                          <CampoImagen
                            etiqueta="Foto del hotel"
                            ayuda="Pie: «Nombre del hotel»"
                            carpeta={carpeta}
                            imagen={viaje.hotel.foto}
                            onCambio={(imagen) => hotel({ foto: imagen })}
                          />

                          <CampoImagen
                            etiqueta="Ruta hotel · estadio"
                            ayuda="Pie: «Hotel · estadio, minutos»"
                            carpeta={carpeta}
                            imagen={viaje.hotel.ruta}
                            onCambio={(imagen) => hotel({ ruta: imagen })}
                          />
                        </div>
                      </Panel>
                    </div>
                  )}

                  {/* =================== HORARIO =================== */}

                  <div className="mt-5 scroll-mt-20" id="viaje-horario">
                    {/*
                    | Con `key`: al cambiar de partido el editor empieza de
                    | cero. Sin ella, «Deshacer» guardaba los días del viaje
                    | anterior y los podía meter en éste.
                    */}
                    <EditorHorario
                      key={partido.id}
                      viaje={viaje}
                      onCambio={(dias) => campo("dias", dias)}
                      copiado={diaCopiado}
                      onCopiado={setDiaCopiado}
                    />
                  </div>

                  {/* ==================== AVISOS ================== */}

                  <div className="mt-5 scroll-mt-20" id="viaje-avisos">
                    <Panel
                      title="No olvidar"
                      subtitle="La línea del pie de la hoja del horario. Uno por línea."
                      icon={Bus}
                    >
                      <TextArea
                        label="Avisos"
                        value={viaje.avisos.join("\n")}
                        onChange={(valor) =>
                          campo(
                            "avisos",
                            valor.split("\n").map((linea) => linea.trimStart()),
                          )
                        }
                        placeholder={"Traje de paseo\nDNI\nBotas de recambio"}
                        rows={4}
                      />
                    </Panel>
                  </div>

                  {/* ================ VISTA PREVIA ================ */}

                  <div className="mt-5 scroll-mt-20" id="viaje-vista">
                    <Panel
                      title="Cómo va a quedar"
                      subtitle="Es el documento de verdad, a escala: lo que se ve aquí es exactamente lo que se exporta"
                      icon={Eye}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          tone={vista === "dossier" ? "primary" : "ghost"}
                          onClick={() => setVista("dossier")}
                        >
                          Dossier · {titulosDossier(viaje).length} diapositivas
                        </Button>

                        <Button
                          tone={vista === "horario" ? "primary" : "ghost"}
                          onClick={() => setVista("horario")}
                        >
                          Horario · {viaje.dias.length}{" "}
                          {viaje.dias.length === 1 ? "hoja A4" : "hojas A4"}
                        </Button>
                      </div>

                      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#11161C] p-3">
                        {vista === "dossier" ? (
                          <Escalado
                            ancho={DOSSIER_W}
                            alto={
                              (DOSSIER_H + 26) * titulosDossier(viaje).length
                            }
                          >
                            <DossierViaje viaje={viaje} />
                          </Escalado>
                        ) : (
                          <div className="mx-auto max-w-[720px]">
                            <Escalado
                              ancho={HOJA_W}
                              alto={
                                (HOJA_H + 26) * Math.max(1, viaje.dias.length)
                              }
                            >
                              <HojasHorario viaje={viaje} />
                            </Escalado>
                          </div>
                        )}
                      </div>
                    </Panel>
                  </div>

                  {/* ================== EXPORTAR ================== */}

                  <div className="mt-5">
                    <ExportaViaje viaje={viaje} />
                  </div>

                </>
              )
            )}

            {/*
            | La nota para el vestuario del otro equipo. Va **fuera** del
            | desplazamiento elegido: no lleva rival ni fecha y es la misma
            | todo el año, así que tiene que poder bajarse aunque no haya
            | ningún partido montado. Lo único que mira del partido es si se
            | juega en casa o fuera, para abrir de entrada la que toca.
            */}
            <div className="mt-8 border-t border-white/10 pt-8">
              <NotasVestuario
                condicion={
                  partido ? (partido.isHome ? "local" : "visitante") : undefined
                }
              />
            </div>

            {/* ============== COPIAR DE OTRO VIAJE ============== */}

            {copiando && viaje && (
              <Dialog
                title="Copiar de otro viaje"
                subtitle="Elige de cuál y qué te traes. Lo que marques se sustituye en este viaje; se puede deshacer justo después."
                onClose={() => setCopiando(false)}
                footer={
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button onClick={() => setCopiando(false)}>Cancelar</Button>

                    <Button
                      tone="primary"
                      icon={Copy}
                      onClick={confirmaCopia}
                      disabled={
                        !fuenteCopia ||
                        !(
                          queCopiar.horario ||
                          queCopiar.rutina ||
                          queCopiar.estadio ||
                          queCopiar.hotel
                        )
                      }
                    >
                      Copiar
                    </Button>
                  </div>
                }
              >
                <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
                  De qué viaje
                </p>

                <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {otrosViajes.map((uno) => (
                    <label
                      key={uno.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition ${
                        fuenteCopia === uno.id
                          ? "border-[#C8A96B]/60 bg-[#C8A96B]/[0.08]"
                          : "border-white/10 hover:border-white/25"
                      }`}
                    >
                      <input
                        type="radio"
                        name="fuente-copia"
                        checked={fuenteCopia === uno.id}
                        onChange={() => eligeFuente(uno.id)}
                        className="h-4 w-4 accent-[#C8A96B]"
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-white/85">
                          {uno.etiqueta}
                        </span>

                        <span className="block text-[11px] text-white/40">
                          {uno.dias} {uno.dias === 1 ? "día" : "días"} ·{" "}
                          {uno.citas} {uno.citas === 1 ? "cita" : "citas"}
                        </span>
                      </span>

                      {uno.mismoRival && (
                        <span className="shrink-0 rounded-full bg-[#C8A96B]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#C8A96B]">
                          Mismo rival
                        </span>
                      )}
                    </label>
                  ))}
                </div>

                <p className="mb-2 mt-4 text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Qué te traes
                </p>

                <div className="grid gap-1.5 sm:grid-cols-2">
                  {(
                    [
                      ["horario", "El horario", "Todos los días y sus citas; el del partido, movido a la hora de éste"],
                      ["rutina", "Salida y avisos", "De dónde sale el autobús y la línea «No olvidar»"],
                      ["estadio", "El estadio", "Nombre, datos y planos: sirve contra el mismo rival"],
                      ["hotel", "El hotel", "Nombre, datos y fotos: sirve contra el mismo rival"],
                    ] as const
                  ).map(([clave, rotulo, pista]) => (
                    <label
                      key={clave}
                      className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/10 px-3 py-2 transition hover:border-white/25"
                    >
                      <input
                        type="checkbox"
                        checked={queCopiar[clave]}
                        onChange={(evento) =>
                          setQueCopiar((actual) => ({
                            ...actual,
                            [clave]: evento.target.checked,
                          }))
                        }
                        className="mt-0.5 h-4 w-4 accent-[#C8A96B]"
                      />

                      <span>
                        <span className="block text-sm text-white/85">{rotulo}</span>
                        <span className="block text-[11px] leading-snug text-white/40">
                          {pista}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </Dialog>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
