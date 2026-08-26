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
 * 2. **El horario se calcula desde esa hora.** Tres plantillas montan el día
 *    entero por desfases respecto al saque inicial; ver `EditorHorario`.
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
  ClipboardList,
  Copy,
  Eye,
  Hotel,
  Landmark,
  Link2,
  RotateCcw,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import {
  AbpHeader,
  Button,
  Field,
  Notice,
  Panel,
  SaveState,
  TextArea,
} from "@/components/abp/ui";
import { CampoImagen } from "@/components/viaje/CampoImagen";
import { DossierViaje, titulosDossier } from "@/components/viaje/DossierViaje";
import { EditorHorario } from "@/components/viaje/EditorHorario";
import { ExportaViaje } from "@/components/viaje/ExportaViaje";
import { HojaHorario } from "@/components/viaje/HojaHorario";
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
  DOSSIER_H,
  DOSSIER_W,
  EMPTY_VIAJE_STORE,
  HOJA_H,
  HOJA_W,
  copiaViaje,
  viajeVacio,
  type Desplazamiento,
  type ViajeStore,
} from "@/lib/viaje/modelo";
import { barlowCondensed } from "@/lib/rivals/portada-font";

/** "J07 · 18 oct 2026 · @ Teruel", como se llama a la semana en la caseta. */
function etiquetaPartido(partido: MatchMeta) {
  const numero = partido.competition.match(/^Jornada\s+(\d+)/i);

  const jornada = numero ? `J${numero[1].padStart(2, "0")} · ` : "";

  return `${jornada}${formatMatchDate(partido)} · ${matchLabel(partido)}`;
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
/*  LA PÁGINA                                                          */
/* ------------------------------------------------------------------ */

export default function DesplazamientoPage() {
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

  const partidos = useMemo(
    () => mezclaCalendario(jugados, jornadas),
    [jugados, jornadas],
  );

  /*
  | Al entrar manda el último desplazamiento tocado y, si no hay ninguno, el
  | **próximo** partido: preparar un viaje es tarea de la semana de antes, no
  | de repasar la temporada.
  */
  const porDefecto = useMemo(() => {
    if (partidos.length === 0) return "";

    const conViaje = partidos.filter((item) => store.viajes?.[item.id]);

    if (conViaje.length) return conViaje[conViaje.length - 1].id;

    const hoy = new Date().toISOString().slice(0, 10);

    return (partidos.find((item) => item.date && item.date >= hoy) ?? partidos[0])
      .id;
  }, [partidos, store.viajes]);

  const elegido = pedido || porDefecto;

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

    if (guardado) return guardado;

    const base = viajeVacio(partido.id, {
      rival: partido.opponent,
      jornada: jornada?.jornada ?? "",
      rivalId: jornada?.id,
      fecha: partido.date,
      hora: "",
      condicion: partido.isHome ? "local" : "visitante",
      competicion: partido.competition,
    });

    /* La hoja RIVALES trae las dimensiones del campo del rival: es el único
       dato del dossier que ya está escrito en algún sitio. */
    return jornada?.fila?.DIMENSIONES
      ? {
          ...base,
          estadio: { ...base.estadio, dimensiones: jornada.fila.DIMENSIONES },
        }
      : base;
  }, [partido, store.viajes, jornada]);

  const guardado = Boolean(partido && store.viajes?.[partido.id]);

  const muta = useCallback(
    (fn: (actual: Desplazamiento) => Desplazamiento) => {
      if (!partido || !viaje) return;

      setStore((actual) => ({
        ...actual,
        viajes: {
          ...actual.viajes,
          [partido.id]: {
            ...fn(actual.viajes?.[partido.id] ?? viaje),
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

  const traeDelAnterior = () => {
    if (!anterior || !viaje) return;

    const fuente = store.viajes?.[anterior.id];

    if (!fuente) return;

    muta((actual) => copiaViaje(fuente, actual));

    toast.success(
      `Traídos la rutina y el horario de ${matchLabel(anterior)}, con las horas movidas a este partido`,
    );
  };

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
              lead="El dossier del viaje —campo, ruta y hotel— y el horario del día, rellenados de una vez y sacados en PowerPoint o en PDF para imprimir. El horario se monta solo desde la hora del partido."
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
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Partido
                </span>

                <select
                  value={elegido}
                  onChange={(evento) => setPedido(evento.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
                >
                  {partidos.length === 0 && (
                    <option value="">
                      {cargando ? "Cargando calendario…" : "Sin partidos"}
                    </option>
                  )}

                  {partidos.map((item) => (
                    <option key={item.id} value={item.id} className="bg-[#11161C]">
                      {etiquetaPartido(item)}
                      {store.viajes?.[item.id] ? " ✓" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap items-end gap-2">
                {anterior && (
                  <Button
                    icon={Copy}
                    onClick={traeDelAnterior}
                    title={`Traer la rutina y el horario de ${matchLabel(anterior)}, con las horas recalculadas`}
                  >
                    Traer de {matchLabel(anterior)}
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
                      <Notice title="Todavía sin montar">
                        Lo que se ve son los datos que trae el calendario. En
                        cuanto escribas algo, el desplazamiento se guarda solo.
                      </Notice>
                    </div>
                  )}

                  {/* ================== EL PARTIDO ================== */}

                  <div className="mt-5">
                    <Panel
                      title="El partido"
                      subtitle="La cabecera que llevan las tres diapositivas y la hoja del horario"
                      icon={Shield}
                    >
                      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Field
                          label="Rival"
                          value={viaje.rival}
                          onChange={(valor) => campo("rival", valor)}
                          placeholder={partido.opponent}
                          hint="Como se quiere leer: la hoja dice «CD Teruel» y en la caseta se dice «Teruel»."
                        />

                        <Field
                          label="Jornada"
                          value={viaje.jornada}
                          onChange={(valor) => campo("jornada", valor)}
                          placeholder="1"
                        />

                        <Field
                          label="Fecha"
                          value={viaje.fecha}
                          onChange={(valor) => campo("fecha", valor)}
                          placeholder="2026-08-31"
                          hint="En formato AAAA-MM-DD: de ahí sale el día escrito entero."
                        />

                        <Field
                          label="Hora del partido"
                          value={viaje.hora}
                          onChange={(valor) => campo("hora", valor)}
                          placeholder="21:15"
                          hint="Es la cifra que manda: el horario del día se calcula desde ella."
                        />
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

                  <div className="mt-5">
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
                          placeholder="Campo Pinilla"
                        />

                        <Field
                          label="Ciudad"
                          value={viaje.estadio.ciudad}
                          onChange={(valor) => estadio({ ciudad: valor })}
                          placeholder="Teruel"
                        />

                        <Field
                          label="Superficie"
                          value={viaje.estadio.superficie}
                          onChange={(valor) => estadio({ superficie: valor })}
                          placeholder="Natural"
                        />

                        <Field
                          label="Dimensiones"
                          value={viaje.estadio.dimensiones}
                          onChange={(valor) => estadio({ dimensiones: valor })}
                          placeholder="103 × 65"
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
                          placeholder="Av. de Aragón, Teruel"
                        />

                        <Field
                          label="Distancia"
                          value={viaje.estadio.distancia}
                          onChange={(valor) => estadio({ distancia: valor })}
                          placeholder="365 km"
                        />

                        <Field
                          label="Tiempo de viaje"
                          value={viaje.estadio.tiempo}
                          onChange={(valor) => estadio({ tiempo: valor })}
                          placeholder="3 h 30"
                        />

                        <Field
                          label="Enlace del mapa"
                          value={viaje.estadio.enlace}
                          onChange={(valor) => estadio({ enlace: valor })}
                          placeholder="https://maps.app.goo.gl/…"
                        />
                      </div>

                      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                        <CampoImagen
                          etiqueta="Plano del estadio"
                          ayuda="Pie: «Estadio Pinilla · acceso autobús»"
                          carpeta={carpeta}
                          imagen={viaje.estadio.plano}
                          onCambio={(imagen) => estadio({ plano: imagen })}
                        />

                        <CampoImagen
                          etiqueta="Ruta del autobús"
                          ayuda="Pie: «Valdebebas · Teruel, 365 km»"
                          carpeta={carpeta}
                          imagen={viaje.estadio.ruta}
                          onCambio={(imagen) => estadio({ ruta: imagen })}
                        />
                      </div>
                    </Panel>
                  </div>

                  {/* =================== EL HOTEL ================== */}

                  {viaje.conHotel && (
                    <div className="mt-5">
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
                            placeholder="Hotel Palacio la Marquesa"
                          />

                          <Field
                            label="Dirección"
                            value={viaje.hotel.direccion}
                            onChange={(valor) => hotel({ direccion: valor })}
                            placeholder="C/ Comunidad de Aragón, 10"
                          />

                          <Field
                            label="Teléfono"
                            value={viaje.hotel.telefono}
                            onChange={(valor) => hotel({ telefono: valor })}
                            placeholder="978 60 00 00"
                          />

                          <Field
                            label="Entrada"
                            value={viaje.hotel.entrada}
                            onChange={(valor) => hotel({ entrada: valor })}
                            placeholder="Lunes 31 · 14:00"
                          />
                        </div>

                        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <Field
                            label="Distancia al campo"
                            value={viaje.hotel.distancia}
                            onChange={(valor) => hotel({ distancia: valor })}
                            placeholder="2,4 km"
                          />

                          <Field
                            label="Tiempo al campo"
                            value={viaje.hotel.tiempo}
                            onChange={(valor) => hotel({ tiempo: valor })}
                            placeholder="7 minutos"
                          />

                          <Field
                            label="Enlace de la reserva"
                            value={viaje.hotel.enlace}
                            onChange={(valor) => hotel({ enlace: valor })}
                            placeholder="https://…"
                          />
                        </div>

                        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                          <CampoImagen
                            etiqueta="Foto del hotel"
                            ayuda="Pie: «Hotel Palacio la Marquesa»"
                            carpeta={carpeta}
                            imagen={viaje.hotel.foto}
                            onCambio={(imagen) => hotel({ foto: imagen })}
                          />

                          <CampoImagen
                            etiqueta="Ruta hotel · estadio"
                            ayuda="Pie: «Hotel · Pinilla, 7 minutos»"
                            carpeta={carpeta}
                            imagen={viaje.hotel.ruta}
                            onCambio={(imagen) => hotel({ ruta: imagen })}
                          />
                        </div>
                      </Panel>
                    </div>
                  )}

                  {/* =================== HORARIO =================== */}

                  <div className="mt-5">
                    <EditorHorario
                      viaje={viaje}
                      onCambio={(horario) => campo("horario", horario)}
                    />
                  </div>

                  {/* ==================== AVISOS ================== */}

                  <div className="mt-5">
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

                  <div className="mt-5">
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
                          Horario · 1 hoja A4
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
                            <Escalado ancho={HOJA_W} alto={HOJA_H + 26}>
                              <HojaHorario viaje={viaje} />
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

                  {viaje.estadio.enlace.trim() && (
                    <p className="mt-4 text-xs text-white/35">
                      <Link2 size={12} className="mr-1 inline" />
                      Mapa del estadio:{" "}
                      <a
                        href={viaje.estadio.enlace}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#C8A96B] underline underline-offset-2"
                      >
                        {viaje.estadio.enlace}
                      </a>
                    </p>
                  )}
                </>
              )
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
