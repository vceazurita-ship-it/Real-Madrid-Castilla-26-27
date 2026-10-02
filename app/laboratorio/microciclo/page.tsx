"use client";

/**
 * CREAR O EDITAR UN MICROCICLO EN LA HOJA DE REGISTRO.
 *
 * Dos caminos (01/10/2026):
 *
 * - **Crear el siguiente**: la semana sale del calendario y, por defecto, se
 *   rellena con lo que ya está escrito en la hoja —el último microciclo con
 *   tareas, atado por MD—, así que se parte de la semana anterior y se cambia
 *   lo que toque.
 * - **Editar uno que ya está**: se elige cualquiera de la hoja, se carga con
 *   TODAS sus columnas (`registroFilas`, no el CSV) y al escribir se
 *   sustituyen sus filas en el mismo sitio. Las columnas que el editor no
 *   maneja —la evaluación y el análisis post— viajan intactas.
 *
 * La pestaña de registro de tareas es de donde come todo lo que analiza
 * microciclos —`/microcycles`, la transferencia de Data Análisis, el microciclo
 * de ABP, el calendario de micros—, y hasta ahora sólo se podía rellenar a mano
 * en Google Sheets, fila a fila. Esto la escribe desde aquí.
 *
 * ESTÁ PENSADA PARA TERMINARLA EN CINCO MINUTOS
 *
 * - **La semana viene hecha**: los días salen del calendario del Castilla, con
 *   su MD, y el número de microciclo, el rival y la fila del partido también.
 * - **Se puede copiar otra semana**: una semana se parece mucho a la anterior,
 *   así que se traen sus tareas atadas por MD —el MD-2 de aquélla al MD-2 de
 *   ésta— y se cambia lo que toque.
 * - **Las opciones son lo que ya está escrito en la hoja**, ordenado por lo que
 *   más se usa: escribir «Ataque CP» de otra manera rompe los agrupados de las
 *   pantallas que leen esto.
 * - **El borrador no se pierde**: se guarda en este navegador mientras se
 *   rellena, así que cerrar la pestaña sin querer no cuesta el trabajo.
 *
 * LO QUE NO SE MANDA NUNCA: «Carga Ponderada», «Carga cognitiva» y «Demanda
 * Cognitiva». Son fórmulas de la hoja; las filas nuevas se crean clonando la de
 * arriba para heredarlas (y de paso, el formato y las listas desplegables). Ver
 * `scripts/apps-script/registro-tareas.gs`.
 *
 * Está en obras a propósito: escribe en la hoja de verdad, así que primero se
 * mira lo que va a escribir y se pulsa a conciencia.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ArrowDown,
  ArrowUp,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Pencil,
  Copy,
  Eraser,
  ExternalLink,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Moon,
  Dumbbell,
  Trophy,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { AbpHeader, Button, Field, Notice, Panel, Select } from "@/components/abp/ui";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { loadRegistro, type RegistroDataset } from "@/lib/abp/registro";
import {
  FASES_ABP,
  copiaDeTarea,
  copiaEstructura,
  filasDelMicro,
  microDeFilas,
  minutosAbp,
  minutosDe,
  renumera,
  revisaMicro,
  sugerenciasDelRegistro,
  tareaDeCompeticion,
  tareaEnBlanco,
  tareaVacia,
  tareasQueSeEscriben,
  fechaIsoDeHoja,
  type MicroNuevo,
  type SesionNueva,
  type Sugerencias,
  type TareaNueva,
} from "@/lib/registro/hoja";
import {
  CLAVE_CALENDARIO,
  alrededorDe,
  soloDia,
  type PartidoCastilla,
  type PartidoNuestro,
} from "@/lib/castilla/calendario";
import { diaKeyDe, etiquetaDia } from "@/lib/abp/ventana";

const DIA_MS = 86_400_000;

const TEMPORADA = "2026 - 2027";

/** Lo habitual en la hoja: cuatro tareas por sesión y unos 50′. */
const TAREAS_POR_SESION = 4;

const MINUTOS_HABITUALES = { minimo: 35, maximo: 75 };

/** El borrador vive aquí mientras se rellena. */
const BORRADOR = "rmcf-microciclo-borrador";

/**
 * Los días del microciclo, del calendario.
 *
 * Del día siguiente al partido anterior hasta el del próximo, los dos
 * incluidos. El día de después del partido se propone vacío —descanso— y el
 * día del partido trae su fila de competición, que es como está escrito en la
 * hoja toda la temporada.
 */
type DiaVentana = { fecha: string; dia: string; md: string; esPartido: boolean; postPartido: boolean };

/** Los días que abarca el microciclo, con su MD, sin tareas todavía. */
function diasDeVentana(proximo: PartidoNuestro, anterior: PartidoNuestro | null): DiaVentana[] {
  const partido = soloDia(proximo.cuando);

  const desde = anterior ? soloDia(anterior.cuando) : "";

  const dias: string[] = [];

  const inicio = desde
    ? Date.parse(`${desde}T12:00:00Z`) + DIA_MS
    : Date.parse(`${partido}T12:00:00Z`) - 5 * DIA_MS;

  for (let momento = inicio; momento <= Date.parse(`${partido}T12:00:00Z`); momento += DIA_MS) {
    dias.push(new Date(momento).toISOString().slice(0, 10));
  }

  /* Un microciclo largo no cabe en el plan de ABP —que guarda un día por
     letra— así que se recortan los primeros: son los de descanso. */
  const ultimos = dias.slice(-7);

  return ultimos.map((fecha, indice) => {
    const md = Math.round(
      (Date.parse(`${partido}T12:00:00Z`) - Date.parse(`${fecha}T12:00:00Z`)) / DIA_MS,
    );

    return {
      fecha,
      dia: diaKeyDe(fecha),
      md: md === 0 ? "MD" : `MD-${md}`,
      esPartido: md === 0,
      postPartido: indice === 0 && Boolean(desde) && ultimos.length > 4,
    };
  });
}

/** Lo que se propone libre si nadie dice otra cosa: el día después del partido. */
const libresPorDefecto = (dias: DiaVentana[]) =>
  dias.filter((uno) => uno.postPartido && !uno.esPartido).map((uno) => uno.fecha);

/**
 * Las sesiones del microciclo, con los días libres que se han marcado antes.
 *
 * El día del partido trae su fila de competición, que es como está escrito en
 * la hoja toda la temporada; los libres van sin tareas y los de entreno con
 * cuatro huecos, que no se escriben mientras sigan vacíos.
 */
function armaSesiones(
  proximo: PartidoNuestro,
  anterior: PartidoNuestro | null,
  libres?: string[],
): SesionNueva[] {
  const dias = diasDeVentana(proximo, anterior);
  const marcados = new Set(libres ?? libresPorDefecto(dias));

  return dias.map((uno) => {
    if (uno.esPartido) return { fecha: uno.fecha, dia: uno.dia, md: uno.md, tareas: [tareaDeCompeticion(uno.dia)] };

    if (marcados.has(uno.fecha)) return { fecha: uno.fecha, dia: uno.dia, md: uno.md, tareas: [], libre: true };

    return {
      fecha: uno.fecha,
      dia: uno.dia,
      md: uno.md,
      tareas: Array.from({ length: TAREAS_POR_SESION }, (_, i) => tareaVacia(uno.dia, i + 1)),
    };
  });
}

/* ------------------------------------------------------------------ */
/*  LOS DÍAS: ENTRENO O LIBRE                                          */
/* ------------------------------------------------------------------ */

/**
 * La tira de días de la semana, para marcar cuáles son libres.
 *
 * Se usa antes de crear el microciclo —para que la semana nazca ya con sus
 * libres— y después, para cambiar de idea sin rehacer nada.
 */
function TiraDias({
  dias,
  libres,
  onCambia,
}: {
  dias: { fecha: string; md: string; esPartido: boolean }[];
  libres: Set<string>;
  onCambia: (fecha: string, libre: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {dias.map((uno) => {
        const libre = libres.has(uno.fecha);

        return (
          <div
            key={uno.fecha}
            className={`rounded-xl border px-3 py-2.5 transition ${
              uno.esPartido
                ? "border-[#C8A96B]/50 bg-[#C8A96B]/10"
                : libre
                  ? "border-white/10 bg-white/[0.02]"
                  : "border-emerald-400/30 bg-emerald-400/[0.06]"
            }`}
          >
            <p className="text-[12px] font-semibold capitalize text-white/85">{etiquetaDia(uno.fecha)}</p>
            <p className="text-[11px] text-white/45">{uno.md}</p>

            {uno.esPartido ? (
              <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[#C8A96B]">
                <Trophy size={12} aria-hidden /> Partido
              </p>
            ) : (
              <div className="mt-2 flex rounded-lg border border-white/10 p-0.5 text-[11px]" role="group" aria-label={`${etiquetaDia(uno.fecha)}: entreno o libre`}>
                <button
                  type="button"
                  onClick={() => onCambia(uno.fecha, false)}
                  aria-pressed={!libre}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1 transition ${
                    !libre ? "bg-emerald-400/20 text-emerald-200" : "text-white/45 hover:text-white/80"
                  }`}
                >
                  <Dumbbell size={11} aria-hidden /> Entreno
                </button>
                <button
                  type="button"
                  onClick={() => onCambia(uno.fecha, true)}
                  aria-pressed={libre}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1 transition ${
                    libre ? "bg-white/15 text-white" : "text-white/45 hover:text-white/80"
                  }`}
                >
                  <Moon size={11} aria-hidden /> Libre
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  UNA TAREA                                                          */
/* ------------------------------------------------------------------ */

function FilaTarea({
  tarea,
  sugerencias,
  onCambia,
  onDuplicar,
  onQuitar,
  onSubir,
  onBajar,
}: {
  tarea: TareaNueva;
  sugerencias: Sugerencias;
  onCambia: (cambio: Partial<TareaNueva>) => void;
  onDuplicar: () => void;
  onQuitar: () => void;
  /** Sin función, el botón no sale: la primera no sube, la última no baja. */
  onSubir?: () => void;
  onBajar?: () => void;
}) {
  const [abierta, setAbierta] = useState(false);

  const numero = (valor: string) => Math.max(0, Math.round(Number(valor) || 0));

  const esAbp = FASES_ABP.includes(tarea.fase);

  return (
    <div
      className={`rounded-xl border p-2.5 ${
        esAbp ? "border-[#C8A96B]/25 bg-[#C8A96B]/[0.04]" : "border-white/[0.07] bg-white/[0.02]"
      }`}
    >
      <div className="grid gap-2 md:grid-cols-[86px_1.3fr_1fr_66px_66px_66px_128px] md:items-end">
        <Field label="Tarea" value={tarea.tarea} onChange={(v) => onCambia({ tarea: v })} />

        <Field
          label="Tipo de tarea"
          value={tarea.tipoTarea}
          onChange={(v) => onCambia({ tipoTarea: v })}
          suggestions={sugerencias.tipos}
          placeholder="Rondo Complejo"
        />

        <Select
          label="Fase"
          value={tarea.fase}
          options={["", ...sugerencias.fases]}
          onChange={(v) => onCambia({ fase: v })}
        />

        <Field
          label="Tiempo"
          type="number"
          value={tarea.tiempo ? String(tarea.tiempo) : ""}
          onChange={(v) => onCambia({ tiempo: numero(v) })}
        />

        <Field
          label="Int. (1-5)"
          type="number"
          value={tarea.intensidad ? String(tarea.intensidad) : ""}
          onChange={(v) => onCambia({ intensidad: Math.min(5, numero(v)) })}
        />

        <Field
          label="Cog. (1-5)"
          type="number"
          value={tarea.exigCog ? String(tarea.exigCog) : ""}
          onChange={(v) => onCambia({ exigCog: Math.min(5, numero(v)) })}
        />

        <div className="mb-1 flex gap-1">
          <button
            type="button"
            onClick={onSubir}
            disabled={!onSubir}
            title="Subir esta tarea"
            className="flex h-9 w-7 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-20"
          >
            <ArrowUp size={14} aria-hidden />
          </button>

          <button
            type="button"
            onClick={onBajar}
            disabled={!onBajar}
            title="Bajar esta tarea"
            className="flex h-9 w-7 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-20"
          >
            <ArrowDown size={14} aria-hidden />
          </button>

          <button
            type="button"
            onClick={onDuplicar}
            title="Duplicar esta tarea"
            className="flex h-9 w-8 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/[0.06] hover:text-white/70"
          >
            <Copy size={14} aria-hidden />
          </button>

          <button
            type="button"
            onClick={onQuitar}
            title="Quitar esta tarea"
            className="flex h-9 w-8 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/[0.06] hover:text-rose-300"
          >
            <Trash2 size={14} aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <Field
          label="Contenido principal"
          value={tarea.contenidoPrincipal}
          onChange={(v) => onCambia({ contenidoPrincipal: v })}
          suggestions={sugerencias.principales}
          placeholder="Ataque CP"
        />

        <Field
          label="Contenido secundario"
          value={tarea.contenidoSecundario}
          onChange={(v) => onCambia({ contenidoSecundario: v })}
          suggestions={sugerencias.secundarios}
          placeholder="Último tercio"
        />
      </div>

      <button
        type="button"
        onClick={() => setAbierta((abierto) => !abierto)}
        className="mt-2 flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-white/35 transition hover:text-white/60"
      >
        {abierta ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
        Formato y lo que alimenta la demanda cognitiva
      </button>

      {abierta && (
        <div className="mt-2 grid gap-2 md:grid-cols-4">
          <Field
            label="Formato"
            value={tarea.formato}
            onChange={(v) => onCambia({ formato: v })}
            suggestions={sugerencias.formatos}
            placeholder="8v8+6"
          />

          <Field
            label="Grupo"
            value={tarea.grupo}
            onChange={(v) => onCambia({ grupo: v })}
            suggestions={sugerencias.grupos}
          />

          <Field
            label="Jugadores convocados"
            type="number"
            value={tarea.jugadores ? String(tarea.jugadores) : ""}
            onChange={(v) => onCambia({ jugadores: numero(v) })}
          />

          <Field
            label="Nº jugadores en la tarea"
            type="number"
            value={tarea.nJug ? String(tarea.nJug) : ""}
            onChange={(v) => onCambia({ nJug: numero(v) })}
          />

          <Field
            label="Densidad"
            type="number"
            value={tarea.densidad ? String(tarea.densidad) : ""}
            onChange={(v) => onCambia({ densidad: numero(v) })}
          />

          <Field
            label="Comodines"
            type="number"
            value={tarea.nComodines ? String(tarea.nComodines) : ""}
            onChange={(v) => onCambia({ nComodines: numero(v) })}
          />

          <Field
            label="Normativa"
            type="number"
            value={tarea.normativa ? String(tarea.normativa) : ""}
            onChange={(v) => onCambia({ normativa: numero(v) })}
          />

          <Field
            label="Incertidumbre"
            type="number"
            value={tarea.incertidumbre ? String(tarea.incertidumbre) : ""}
            onChange={(v) => onCambia({ incertidumbre: numero(v) })}
          />

          <Field
            label="Familiaridad"
            type="number"
            value={tarea.familiaridad ? String(tarea.familiaridad) : ""}
            onChange={(v) => onCambia({ familiaridad: numero(v) })}
          />

          <Field
            label="Motivación"
            type="number"
            value={tarea.motivacion ? String(tarea.motivacion) : ""}
            onChange={(v) => onCambia({ motivacion: numero(v) })}
          />

          <div className="md:col-span-2">
            <Field
              label="Observaciones"
              value={tarea.observaciones}
              onChange={(v) => onCambia({ observaciones: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ELEGIR UN MICROCICLO DE LA HOJA                                    */
/* ------------------------------------------------------------------ */

function EligeMicro({
  micros,
  abriendo,
  onAbrir,
}: {
  micros: { micro: number; rival: string; tareas: number }[];
  abriendo: boolean;
  onAbrir: (numero: number) => void;
}) {
  const [elegido, setElegido] = useState("");

  const valor = elegido || String(micros[0]?.micro ?? "");

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[260px] flex-1">
        <Select
          label="Microciclo"
          value={valor}
          options={micros.map((uno) => ({
            value: String(uno.micro),
            label: `Micro ${uno.micro} · ${uno.rival || "sin rival"} (${uno.tareas} tareas)`,
          }))}
          onChange={setElegido}
        />
      </div>

      <Button icon={Pencil} disabled={!valor || abriendo} onClick={() => onAbrir(Number(valor))}>
        {abriendo ? "Leyendo la hoja…" : "Abrir para editar"}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LA PÁGINA                                                          */
/* ------------------------------------------------------------------ */

export default function EditorMicrocicloPage() {
  const [registro, setRegistro] = useState<RegistroDataset | null>(null);

  const [calendario, setCalendario] = useState<PartidoCastilla[]>([]);

  const [cargando, setCargando] = useState(true);

  const [micro, setMicro] = useState<MicroNuevo | null>(null);

  /* Lo que dice el calendario: se resuelve al cargar, no en cada render. */
  const [partido, setPartido] = useState<{
    proximo: PartidoNuestro | null;
    anterior: PartidoNuestro | null;
  }>({ proximo: null, anterior: null });

  const [reemplazar, setReemplazar] = useState(false);

  const [guardando, setGuardando] = useState(false);

  const [escrito, setEscrito] = useState<{
    escritas: number;
    borradas: number;
    filas: number;
  } | null>(null);

  const [revisar, setRevisar] = useState(false);

  /* Los días libres que se marcan ANTES de crear el microciclo. `null` es
     «lo de siempre»: libre el día después del partido. */
  const [libresPlan, setLibresPlan] = useState<string[] | null>(null);

  /*
  | QUÉ SE ESTÁ HACIENDO: crear el siguiente o editar uno de la hoja.
  |
  | `editando` es el número del microciclo que se abrió de la hoja (o que se
  | acaba de escribir): con él, escribir SUSTITUYE sus filas en vez de
  | añadir otras.
  */
  const [editando, setEditando] = useState<number | null>(null);

  const [abriendo, setAbriendo] = useState(false);

  /* De qué microciclo se parte al crear: por defecto, el último con tareas. */
  const [partirDe, setPartirDe] = useState<string>("ultimo");

  /* El día que se quiere añadir a mano. */
  const [diaNuevo, setDiaNuevo] = useState("");

  /* Para no guardar el borrador antes de haberlo leído. */
  const leido = useRef(false);

  const sinCalendario = !cargando && calendario.length === 0;

  /* Las dos fuentes: la hoja (qué micros hay y qué se escribe en ella) y el
     calendario. Y el borrador de este navegador, si lo hubiera. */
  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      const [datos, partidos] = await Promise.all([
        loadRegistro().catch(() => null),
        fetch("/api/docs?key=" + encodeURIComponent(CLAVE_CALENDARIO), { cache: "no-store" })
          .then((r) => r.json() as Promise<{ data?: { partidos?: PartidoCastilla[] } }>)
          .then((leidoDoc) => leidoDoc?.data?.partidos ?? [])
          .catch(() => [] as PartidoCastilla[]),
      ]);

      if (cancelado) return;

      const alrededor = alrededorDe(partidos, Date.now());


      /*
      | El primer partido que TODAVÍA no tiene microciclo.
      |
      | Casi siempre es el próximo, pero cuando la semana en curso ya está
      | escrita en la hoja —como el 20/09/2026, con el micro del Sant Andreu
      | hecho— lo que toca crear es el siguiente.
      */
      /*
      | Un partido «ya tiene microciclo» si la hoja tiene tareas entre el día
      | siguiente al partido anterior y el del partido. Por FECHAS, no por el
      | nombre del rival: la hoja escribe «ATL MADRID B» y el calendario
      | «Atlético Madrileño», y con el nombre se ofrecía crear otra vez la
      | semana del micro 15. Además, en la vuelta el rival se repite.
      */
      const fechasEscritas = [
        ...new Set(
          (datos?.tareas ?? []).map((una) => fechaIsoDeHoja(una.fecha)).filter(Boolean),
        ),
      ];

      const tieneMicro = (uno: (typeof alrededor.todos)[number]) => {
        const dia = soloDia(uno.cuando);

        const anterior = [...alrededor.todos].filter((otro) => otro.cuando < uno.cuando).slice(-1)[0];

        const desde = anterior ? soloDia(anterior.cuando) : "";

        return fechasEscritas.some((fecha) => fecha > desde && fecha <= dia);
      };

      const pendientes = alrededor.proximo
        ? alrededor.todos.filter((uno) => uno.cuando >= (alrededor.proximo?.cuando ?? ""))
        : [];

      const objetivo = pendientes.find((uno) => !tieneMicro(uno)) ?? alrededor.proximo;

      const previo = objetivo
        ? ([...alrededor.todos].filter((uno) => uno.cuando < objetivo.cuando).slice(-1)[0] ?? null)
        : null;

      /*
      | El borrador manda sobre la propuesta: es trabajo de alguien.
      |
      | Pero sólo si sigue teniendo sentido. Un borrador del micro 10 que se
      | quedó a medias, con el 10 ya escrito en la hoja desde entonces, llevaba
      | a marcar «rehacerlo» y **borrar las filas buenas** para escribir las del
      | borrador a medio rellenar. Y el partido que se pinta al lado sale
      | siempre del calendario, así que se veía el número de un microciclo con
      | las fechas de otro. Si el borrador ya está en la hoja, o es de hace más
      | de tres semanas, se tira.
      */
      let guardado: MicroNuevo | null = null;

      try {
        const crudo = window.localStorage.getItem(BORRADOR);

        if (crudo) {
          const posible = JSON.parse(crudo) as MicroNuevo & {
            guardadoEn?: string;
            editando?: number | null;
          };

          /* Una edición a medias sigue valiendo aunque el micro esté en la
             hoja: es justamente lo que se estaba cambiando. */
          const yaEscrito =
            !posible?.editando &&
            (datos?.micros ?? []).some(
              (uno) => uno.micro === posible?.micro && uno.tareas > 0,
            );

          const viejo =
            posible?.guardadoEn != null &&
            Date.now() - Date.parse(posible.guardadoEn) > 21 * 86_400_000;

          if (posible?.sesiones?.length && !yaEscrito && !viejo) guardado = posible;
          else if (posible?.sesiones?.length) window.localStorage.removeItem(BORRADOR);
        }
      } catch {
        /* Sin borrador se empieza con la propuesta, que es lo normal. */
      }

      setRegistro(datos);
      setCalendario(partidos);
      setPartido({ proximo: objetivo, anterior: previo });

      /* Sin borrador, la semana NO se crea sola: primero se marcan los días
         libres (paso 1) y luego se crea con ellos. */
      if (guardado) {
        const { editando: deEdicion, ...soloMicro } = guardado as MicroNuevo & {
          editando?: number | null;
          guardadoEn?: string;
        };

        setMicro(soloMicro);

        if (deEdicion) {
          setEditando(deEdicion);
          setReemplazar(true);
        }
      }

      leido.current = true;

      setCargando(false);
    };

    void cargar();

    return () => {
      cancelado = true;
    };
  }, []);

  /* El borrador, en este navegador. No es un guardado: es no perder el rato. */
  useEffect(() => {
    if (!leido.current || !micro) return;

    try {
      /* Con la fecha de guardado: un borrador de hace un mes no se restaura. */
      window.localStorage.setItem(
        BORRADOR,
        JSON.stringify({ ...micro, editando, guardadoEn: new Date().toISOString() }),
      );
    } catch {
      /* Sin sitio en el navegador se sigue igual, sólo que sin red. */
    }
  }, [micro, editando]);

  const { proximo, anterior } = partido;

  const ultimoMicro = useMemo(
    () => registro?.micros.reduce((mayor, uno) => Math.max(mayor, uno.micro), 0) ?? 0,
    [registro],
  );

  const sugerencias = useMemo(() => sugerenciasDelRegistro(registro?.tareas ?? []), [registro]);

  /* La temporada como está escrita en la hoja: «2026-2027» y «2026 - 2027»
     no se agrupan juntas en las pantallas que la leen. */
  const temporadaHoja = useMemo(() => {
    const ultimo = [...(registro?.micros ?? [])].sort((a, b) => b.micro - a.micro)[0];

    return ultimo?.temporada?.trim() || TEMPORADA;
  }, [registro]);

  /** Los micros de la hoja, del más nuevo al más viejo. */
  const microsDeLaHoja = useMemo(
    () => [...(registro?.micros ?? [])].sort((a, b) => b.micro - a.micro),
    [registro],
  );

  /** El último con tareas: del que se parte por defecto al crear. */
  const ultimoConTareas = microsDeLaHoja.find((uno) => uno.tareas > 0)?.micro ?? null;

  /** Vuelve a montar los días con el calendario, respetando los libres. */
  const arma = useCallback(() => {
    if (!proximo) return;

    if (
      micro?.sesiones.some((sesion) => sesion.tareas.some((tarea) => !tareaEnBlanco(tarea) && !/-COMP$/i.test(tarea.tarea))) &&
      !window.confirm("Rehacer los días vacía las tareas que ya has rellenado. ¿Seguir?")
    ) {
      return;
    }

    setMicro((actual) => ({
      temporada: actual?.temporada || TEMPORADA,
      micro: actual?.micro || ultimoMicro + 1,
      rival: actual?.rival || proximo.rival.toUpperCase(),
      sesiones: armaSesiones(
        proximo,
        anterior,
        actual?.sesiones.filter((sesion) => sesion.libre).map((sesion) => sesion.fecha),
      ),
    }));

    setEscrito(null);

    toast.success("Días rehechos con el calendario");
  }, [micro, proximo, anterior, ultimoMicro]);

  /* ------------------- PASO 1: LA SEMANA ------------------- */

  const diasPlan = useMemo(() => (proximo ? diasDeVentana(proximo, anterior) : []), [proximo, anterior]);

  const libresMarcados = useMemo(
    () => new Set(libresPlan ?? libresPorDefecto(diasPlan)),
    [libresPlan, diasPlan],
  );

  const creaMicro = () => {
    if (!proximo) return;

    const vacio: MicroNuevo = {
      temporada: temporadaHoja,
      micro: ultimoMicro + 1,
      rival: proximo.rival.toUpperCase(),
      sesiones: armaSesiones(proximo, anterior, [...libresMarcados]),
    };

    /* Lo ya relleno en la hoja es la base: el último micro, o el elegido. */
    const origen =
      partirDe === "ultimo" ? ultimoConTareas : partirDe ? Number(partirDe) : null;

    const hecho = origen ? copiaSobre(vacio, origen) : null;

    setMicro(hecho?.micro ?? vacio);
    setEditando(null);
    setReemplazar(false);
    setEscrito(null);

    const libres = libresMarcados.size;

    toast.success(`Microciclo ${ultimoMicro + 1} creado`, {
      description:
        `${diasPlan.length - libres - 1} día(s) de entreno, ${libres} libre(s) y el partido.` +
        (hecho
          ? ` Relleno con ${hecho.puestas} tarea(s) del micro ${origen} (${hecho.rival || "—"}), atadas por MD: cambia lo que toque.`
          : ""),
    });
  };

  /*
  | EDITAR UNO QUE YA ESTÁ
  |
  | Se lee de la hoja con todas sus columnas (el CSV no trae la demanda
  | cognitiva y va minutos por detrás). Si la hoja no contesta, no se abre:
  | editar con datos incompletos y reescribir borraría lo que falta.
  */
  const abreParaEditar = async (numero: number) => {
    if (
      micro &&
      micro.sesiones.some((sesion) => sesion.tareas.some((tarea) => !tareaEnBlanco(tarea) && !/-COMP$/i.test(tarea.tarea))) &&
      !window.confirm("Tienes un microciclo a medias en pantalla. ¿Dejarlo y abrir el otro?")
    ) {
      return;
    }

    const suyo = registro?.micros.find((uno) => uno.micro === numero);

    setAbriendo(true);

    const aviso = toast.loading(`Leyendo el microciclo ${numero} de la hoja…`);

    try {
      const respuesta = await fetch("/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "filas", micro: numero, temporada: suyo?.temporada ?? "" }),
      });

      const datos = (await respuesta.json()) as { ok?: boolean; error?: string; filas?: Record<string, unknown>[] };

      if (!respuesta.ok || !datos.ok || !Array.isArray(datos.filas)) {
        throw new Error(datos.error ?? `HTTP ${respuesta.status}`);
      }

      if (datos.filas.length === 0) throw new Error("La hoja no tiene filas de ese microciclo.");

      setMicro(
        microDeFilas(datos.filas, {
          temporada: suyo?.temporada ?? temporadaHoja,
          micro: numero,
          rival: suyo?.rival ?? "",
        }),
      );

      setEditando(numero);
      setReemplazar(true);
      setEscrito(null);

      toast.success(`Microciclo ${numero} abierto`, {
        id: aviso,
        description: `${datos.filas.length} fila(s). Al escribir se sustituyen en el mismo sitio de la hoja.`,
      });
    } catch (error) {
      const dice = error instanceof Error ? error.message : "Inténtalo otra vez";

      toast.error("No se ha podido abrir", {
        id: aviso,
        description: /acci[oó]n|action|desconocid|reconocid/i.test(dice)
          ? "La hoja todavía no conoce la lectura del registro: falta pegar scripts/abp-hoja.gs en el Apps Script del libro de ABP y publicar versión nueva."
          : dice,
      });
    } finally {
      setAbriendo(false);
    }
  };

  /** Añade un día a mano, en su sitio del calendario. */
  const anadeDia = () => {
    if (!micro || !/^\d{4}-\d{2}-\d{2}$/.test(diaNuevo)) return;

    if (micro.sesiones.some((sesion) => sesion.fecha === diaNuevo)) {
      toast.error("Ese día ya está en el microciclo");

      return;
    }

    const dia = diaKeyDe(diaNuevo);

    setMicro({
      ...micro,
      sesiones: [
        ...micro.sesiones,
        {
          fecha: diaNuevo,
          dia,
          md: "",
          tareas: Array.from({ length: TAREAS_POR_SESION }, (_, i) => tareaVacia(dia, i + 1)),
        },
      ].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    });

    setDiaNuevo("");

    toast.success(`${etiquetaDia(diaNuevo)} añadido`, { description: "Ponle su MD (MD-3, MD+1…)." });
  };

  /** Mueve una tarea dentro de su sesión. */
  const mueveTarea = (indice: number, desde: number, hasta: number) => {
    if (!micro) return;

    const tareas = [...micro.sesiones[indice].tareas];

    if (hasta < 0 || hasta >= tareas.length) return;

    const [una] = tareas.splice(desde, 1);

    tareas.splice(hasta, 0, una);

    cambiaSesion(indice, { tareas });
  };

  /** Cambiar un día a libre o a entreno con el microciclo ya creado. */
  const cambiaLibre = (fecha: string, libre: boolean) => {
    if (!micro) return;

    const indice = micro.sesiones.findIndex((sesion) => sesion.fecha === fecha);
    const sesion = micro.sesiones[indice];

    if (!sesion || Boolean(sesion.libre) === libre) return;

    if (libre) {
      const rellenas = sesion.tareas.filter((tarea) => !tareaEnBlanco(tarea)).length;

      if (rellenas > 0 && !window.confirm(`${etiquetaDia(fecha)} tiene ${rellenas} tarea(s) rellena(s). Si lo pasas a libre se quitan. ¿Seguir?`)) {
        return;
      }

      cambiaSesion(indice, { libre: true, tareas: [] });
    } else {
      cambiaSesion(indice, {
        libre: false,
        tareas: Array.from({ length: TAREAS_POR_SESION }, (_, i) => tareaVacia(sesion.dia, i + 1)),
      });
    }
  };

  const yaEnLaHoja = useMemo(
    () =>
      (micro !== null && editando === micro.micro) ||
      (registro?.micros.some((uno) => uno.micro === micro?.micro) ?? false),
    [registro, micro, editando],
  );

  /* El partido de ese microciclo, para pintarlo al lado: al crear, el del
     calendario; al editar, el del rival más cercano a sus fechas. */
  const partidoDelMicro = useMemo(() => {
    if (!micro) return null;

    if (editando === null) return proximo;

    const fin = micro.sesiones[micro.sesiones.length - 1]?.fecha ?? "";

    /* Por fecha: el nombre de la hoja («ATL MADRID B») no tiene por qué
       coincidir con el del calendario («Atlético Madrileño»). */
    return (
      alrededorDe(calendario, 0)
        .todos.filter((uno) => uno?.rival)
        .sort(
          (a, b) =>
            Math.abs(Date.parse(soloDia(a.cuando)) - Date.parse(fin)) -
            Math.abs(Date.parse(soloDia(b.cuando)) - Date.parse(fin)),
        )[0] ?? null
    );
  }, [calendario, editando, micro, proximo]);

  /* La semana de un vistazo: minutos y carga (tiempo × intensidad) por día. */
  const vistazo = useMemo(
    () =>
      (micro?.sesiones ?? []).map((sesion) => {
        const tareas = tareasQueSeEscriben(sesion);

        return {
          fecha: sesion.fecha,
          md: sesion.md,
          libre: Boolean(sesion.libre),
          minutos: tareas.reduce((n, t) => n + (t.tiempo || 0), 0),
          carga: tareas.reduce((n, t) => n + (t.tiempo || 0) * (t.intensidad || 0), 0),
          abp: tareas.filter((t) => FASES_ABP.includes(t.fase)).reduce((n, t) => n + (t.tiempo || 0), 0),
        };
      }),
    [micro],
  );

  const cargaMaxima = Math.max(1, ...vistazo.map((d) => d.carga));

  const filas = useMemo(() => (micro ? filasDelMicro(micro) : []), [micro]);

  const problemas = useMemo(
    () => (micro ? revisaMicro(micro, { permitirRepetidas: editando !== null }) : []),
    [micro, editando],
  );

  const cuentas = useMemo(
    () => (micro ? minutosDe(micro.sesiones) : { porFecha: {}, total: 0, tareas: 0 }),
    [micro],
  );

  /* Las que se quedan fuera por no tener nada: se dice, para que no sorprenda. */
  const enBlanco = useMemo(
    () =>
      micro
        ? micro.sesiones.reduce(
            (suma, sesion) => suma + (sesion.libre ? 0 : sesion.tareas.filter(tareaEnBlanco).length),
            0,
          )
        : 0,
    [micro],
  );

  const deAbp = useMemo(() => (micro ? minutosAbp(micro.sesiones) : 0), [micro]);

  /* --------------------------- EDICIÓN --------------------------- */

  const cambiaSesion = (indice: number, cambio: Partial<SesionNueva>) =>
    setMicro((actual) =>
      actual
        ? {
            ...actual,
            sesiones: actual.sesiones.map((sesion, i) =>
              i === indice ? renumera({ ...sesion, ...cambio }) : sesion,
            ),
          }
        : actual,
    );

  const cambiaTarea = (sesion: number, tarea: number, cambio: Partial<TareaNueva>) =>
    setMicro((actual) =>
      actual
        ? {
            ...actual,
            sesiones: actual.sesiones.map((una, i) =>
              i === sesion
                ? {
                    ...una,
                    tareas: una.tareas.map((suya, j) =>
                      j === tarea ? { ...suya, ...cambio } : suya,
                    ),
                  }
                : una,
            ),
          }
        : actual,
    );

  /**
   * La semana de otro microciclo puesta sobre `base`, atando por MD. Pura:
   * la usan el botón de copiar y la creación del siguiente.
   */
  const copiaSobre = (base: MicroNuevo, numero: number) => {
    if (!registro) return null;

    const suyas = registro.tareas.filter((tarea) => tarea.micro === numero);

    if (suyas.length === 0) return null;

    /* Los días libres se quedan libres: sólo se copia en los de entreno y el partido. */
    const activas = base.sesiones.filter((sesion) => !sesion.libre);

    const copiado = copiaEstructura(
      activas,
      suyas.map((tarea) => ({
        dia: tarea.dia || "",
        md: tarea.md,
        tarea: tarea.tarea,
        tipoTarea: tarea.tipoTarea,
        fase: tarea.fase,
        formato: tarea.formato,
        grupo: tarea.grupo,
        contenidoPrincipal: tarea.contenidoPrincipal,
        contenidoSecundario: tarea.contenidoSecundario,
        /* Tiempo e intensidad no viajan: los rellena otra persona. */
        tiempo: 0,
        intensidad: 0,
        exigCog: Math.round(tarea.exigCog),
        jugadores: tarea.jugadores,
        densidad: tarea.densidad,
        nJug: tarea.nJug,
        nComodines: tarea.nComodines,
        normativa: tarea.normativa,
        incertidumbre: tarea.incertidumbre,
        familiaridad: tarea.familiaridad,
        motivacion: tarea.motivacion,
      })),
    );

    const porFecha = new Map(copiado.sesiones.map((sesion) => [sesion.fecha, sesion]));

    return {
      micro: {
        ...base,
        sesiones: base.sesiones.map((sesion) =>
          sesion.libre ? sesion : (porFecha.get(sesion.fecha) ?? sesion),
        ),
      },
      puestas: copiado.puestas,
      sinPareja: copiado.sinPareja,
      rival: registro.micros.find((uno) => uno.micro === numero)?.rival ?? "",
    };
  };

  /** Copia la semana de otro microciclo sobre ésta, atando por MD. */
  const copiaDe = (numero: number) => {
    if (!micro) return;

    const hecho = copiaSobre(micro, numero);

    if (!hecho) {
      toast.error("Ese microciclo no tiene tareas en la hoja");

      return;
    }

    setMicro(hecho.micro);

    const { puestas, sinPareja, rival } = hecho;

    /*
    | Se cuenta lo que de verdad ha entrado, no lo que traía el otro micro.
    |
    | Si aquella semana tenía cinco días y ésta tiene cuatro, hay tareas que no
    | encuentran su MD y se quedan fuera. Decir «15 tareas copiadas» cuando en
    | la pantalla hay diez es exactamente el tipo de mentira que hace que nadie
    | se fíe de un aviso. El recuento lo lleva `copiaEstructura`, que es quien
    | sabe qué ha colocado: contar las tareas de la pantalla incluía también
    | las vacías que ya estaban.
    */
    toast.success(`Copiado del microciclo ${numero}`, {
      description:
        `${puestas} tarea(s) de la semana del ${rival || "—"}, atadas por MD.` +
        (sinPareja > 0
          ? ` ${sinPareja} no tenían MD equivalente en esta semana y se han quedado fuera.`
          : "") +
        " Repasa tiempos y contenidos.",
    });
  };

  /* Vuelve al paso 1, con los libres que tenía, para montar la semana otra vez. */
  const empiezaDeCero = () => {
    if (!proximo) return;

    if (
      micro?.sesiones.some((sesion) => sesion.tareas.some((tarea) => !tareaEnBlanco(tarea) && !/-COMP$/i.test(tarea.tarea))) &&
      !window.confirm("Empezar de cero tira el borrador con sus tareas. ¿Seguir?")
    ) {
      return;
    }

    try {
      window.localStorage.removeItem(BORRADOR);
    } catch {
      /* da igual: lo que manda es el estado */
    }

    setLibresPlan(
      micro && editando === null
        ? micro.sesiones.filter((sesion) => sesion.libre).map((sesion) => sesion.fecha)
        : null,
    );
    setMicro(null);
    setEditando(null);
    setReemplazar(false);
    setEscrito(null);
  };

  /* --------------------------- ESCRIBIR --------------------------- */

  const guarda = async () => {
    if (!micro) return;

    setGuardando(true);

    const aviso = toast.loading("Escribiendo en la hoja…");

    try {
      const respuesta = await fetch("/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          temporada: micro.temporada,
          micro: micro.micro,
          rival: micro.rival,
          reemplazar,
          filas,
        }),
      });

      const datos = (await respuesta.json()) as {
        ok?: boolean;
        error?: string;
        escritas?: number;
        borradas?: number;
        filas?: unknown[];
      };

      if (!respuesta.ok || !datos.ok) throw new Error(datos.error ?? `HTTP ${respuesta.status}`);

      setEscrito({
        escritas: datos.escritas ?? filas.length,
        borradas: datos.borradas ?? 0,
        /* Lo releído por la propia hoja: es la comprobación que vale. */
        filas: Array.isArray(datos.filas) ? datos.filas.length : 0,
      });

      try {
        window.localStorage.removeItem(BORRADOR);
      } catch {
        /* nada */
      }

      /* Ya está en la hoja: lo siguiente que se escriba lo sustituye, no lo
         duplica. El CSV tarda minutos en enterarse, así que no se espera. */
      setEditando(micro.micro);
      setReemplazar(true);

      toast.success(`${datos.escritas ?? filas.length} fila(s) escritas`, {
        id: aviso,
        description: "La hoja tarda unos minutos en refrescar el CSV que leen las pantallas.",
      });
    } catch (error) {
      const dice = error instanceof Error ? error.message : "Inténtalo otra vez";

      toast.error("No se ha podido escribir", {
        id: aviso,
        /* El fallo más probable es que el .gs no esté pegado todavía. */
        description: /acci[oó]n|action|no s[eé] qu[eé]|desconocid|reconocid/i.test(dice)
          ? "La hoja no conoce la acción: falta pegar scripts/abp-hoja.gs en el Apps Script del libro de ABP y publicar versión nueva."
          : dice,
      });
    } finally {
      setGuardando(false);
    }
  };

  const listo = Boolean(micro) && problemas.length === 0 && (!yaEnLaHoja || reemplazar);

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="mx-auto min-w-0 max-w-[1500px] px-4 py-6 md:px-8 md:py-8">
          <AbpHeader
            area="RMCF Castilla · Metodología"
            title="Crear o editar el microciclo"
            lead="El siguiente sale del calendario y de lo que ya está escrito en la hoja; cualquiera de los que ya están se abre, se retoca y se reescribe en su sitio."
            aside={
              micro ? (
                <div className="text-right text-[11px] leading-relaxed text-white/45">
                  <p>
                    <span className="text-white/75">{cuentas.tareas}</span> tarea(s) ·{" "}
                    <span className="text-white/75">{cuentas.total}′</span> en total
                  </p>

                  {deAbp > 0 && <p className="text-[#C8A96B]">{deAbp}′ de balón parado</p>}
                </div>
              ) : undefined
            }
          />

          <div className="mt-6 space-y-5">
            {cargando && (
              <p className="text-[12px] text-white/40">Leyendo la hoja y el calendario…</p>
            )}

            {sinCalendario && !proximo && (
              <Notice tone="warn" title="No sé cuándo es el próximo partido">
                El calendario del Castilla lo baja de BeSoccer el ordenador del club. Sin él no se
                puede armar la semana; se puede crear a mano en la hoja como siempre.
              </Notice>
            )}

            {!micro && proximo && !cargando && (
              <Panel
                title="1 · La semana: marca los días libres"
                subtitle={`Microciclo ${ultimoMicro + 1} · contra ${proximo.rival} · J${proximo.jornada}, ${new Date(proximo.cuando).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}`}
                icon={CalendarClock}
              >
                <p className="mb-3 text-[12px] leading-relaxed text-white/50">
                  Del día siguiente al partido anterior hasta el del próximo. Los días libres no llevan sesión y no
                  escriben ninguna fila; el día después del partido viene marcado como libre, pero se puede cambiar.
                </p>

                <TiraDias
                  dias={diasPlan}
                  libres={libresMarcados}
                  onCambia={(fecha, libre) => {
                    const siguiente = new Set(libresMarcados);

                    if (libre) siguiente.add(fecha);
                    else siguiente.delete(fecha);

                    setLibresPlan([...siguiente]);
                  }}
                />

                <div className="mt-4 max-w-md">
                  <Select
                    label="Partir de lo que ya está en la hoja"
                    value={partirDe}
                    options={[
                      {
                        value: "ultimo",
                        label: ultimoConTareas
                          ? `El último: micro ${ultimoConTareas} · ${microsDeLaHoja.find((uno) => uno.micro === ultimoConTareas)?.rival ?? ""}`
                          : "El último (no hay ninguno con tareas)",
                      },
                      { value: "", label: "Semana en blanco" },
                      ...microsDeLaHoja
                        .filter((uno) => uno.tareas > 0 && uno.micro !== ultimoConTareas)
                        .map((uno) => ({
                          value: String(uno.micro),
                          label: `Micro ${uno.micro} · ${uno.rival || "sin rival"} (${uno.tareas} tareas)`,
                        })),
                    ]}
                    onChange={setPartirDe}
                  />
                  <p className="mt-1 text-[11px] text-white/35">
                    Sus tareas entran atadas por MD —el MD-2 de aquella semana al MD-2 de ésta— y luego se cambia lo que toque.
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button tone="primary" icon={Sparkles} onClick={creaMicro}>
                    Crear el microciclo {ultimoMicro + 1}
                  </Button>

                  <Button onClick={() => setLibresPlan(null)} title="Libre sólo el día después del partido">
                    Lo de siempre
                  </Button>

                  <Button onClick={() => setLibresPlan([])} title="Todos los días con sesión">
                    Sin días libres
                  </Button>

                  <span className="text-[11px] text-white/45">
                    {diasPlan.length - libresMarcados.size - 1} día(s) de entreno · {libresMarcados.size} libre(s) · partido
                  </span>
                </div>
              </Panel>
            )}

            {!micro && !cargando && microsDeLaHoja.length > 0 && (
              <Panel
                title="O edita uno que ya está en la hoja"
                subtitle="Se carga con todas sus columnas y, al escribir, se sustituye en el mismo sitio. La evaluación y el análisis post no se tocan."
                icon={Pencil}
              >
                <EligeMicro
                  micros={microsDeLaHoja}
                  abriendo={abriendo}
                  onAbrir={(numero) => void abreParaEditar(numero)}
                />
              </Panel>
            )}

            {micro && (
              <>
                {/* ------------------ QUÉ MICROCICLO ------------------ */}

                <Panel
                  title={
                    editando !== null
                      ? `Editando el microciclo ${micro.micro}`
                      : `Creando el microciclo ${micro.micro}`
                  }
                  subtitle={
                    editando !== null
                      ? "Ya está en la hoja: al escribir se sustituyen sus filas en el mismo sitio"
                      : "Nuevo: sale del calendario y de lo ya escrito; se puede cambiar"
                  }
                  icon={editando !== null ? Pencil : CalendarClock}
                  action={
                    <div className="flex flex-wrap gap-2">
                      {editando === null && proximo && (
                        <Button
                          icon={RefreshCw}
                          onClick={arma}
                          title="Volver a montar los días con el calendario"
                        >
                          Rehacer los días
                        </Button>
                      )}

                      <Button
                        icon={Eraser}
                        onClick={empiezaDeCero}
                        title="Dejar este microciclo y volver a elegir qué hacer"
                      >
                        {editando !== null ? "Cerrar" : "Empezar de cero"}
                      </Button>
                    </div>
                  }
                >
                  <div className="grid gap-3 md:grid-cols-4">
                    <Field
                      label="Temporada"
                      value={micro.temporada}
                      onChange={(v) => setMicro({ ...micro, temporada: v })}
                    />

                    <Field
                      label="Microciclo"
                      type="number"
                      value={String(micro.micro)}
                      onChange={(v) => setMicro({ ...micro, micro: Number(v) || 0 })}
                      hint={`El último en la hoja es el ${ultimoMicro}`}
                    />

                    <Field
                      label="Rival"
                      value={micro.rival}
                      onChange={(v) => setMicro({ ...micro, rival: v })}
                      hint="Como se escribe en la hoja, en mayúsculas"
                      suggestions={[
                        ...(registro?.micros ?? []).map((uno) => uno.rival).filter(Boolean),
                        "NO COMPETICIÓN",
                      ]}
                    />

                    <div className="text-[11px] leading-relaxed text-white/45">
                      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                        Partido
                      </span>

                      {partidoDelMicro ? (
                        <>
                          J{partidoDelMicro.jornada} · {partidoDelMicro.rival} ·{" "}
                          {partidoDelMicro.lado === "casa" ? "en casa" : "fuera"}
                          <br />
                          {new Date(partidoDelMicro.cuando).toLocaleString("es-ES", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </>
                      ) : (
                        "No lo encuentro en el calendario"
                      )}
                    </div>
                  </div>

                  {/* --- Los días: entreno o libre, también después de crearlo --- */}

                  <div className="mt-4">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/40">Días de la semana</p>

                    <TiraDias
                      dias={micro.sesiones.map((sesion) => ({
                        fecha: sesion.fecha,
                        md: sesion.md,
                        esPartido: /^MD$/i.test(sesion.md.trim()),
                      }))}
                      libres={new Set(micro.sesiones.filter((sesion) => sesion.libre).map((sesion) => sesion.fecha))}
                      onCambia={cambiaLibre}
                    />

                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <div className="w-44">
                        <Field label="Añadir un día" type="date" value={diaNuevo} onChange={setDiaNuevo} />
                      </div>

                      <Button icon={CalendarPlus} onClick={anadeDia} disabled={!diaNuevo}>
                        Añadir
                      </Button>

                      <span className="mb-2 text-[11px] text-white/35">
                        Una doble sesión, un amistoso o un día que el calendario no trae.
                      </span>
                    </div>
                  </div>

                  {/* --- La semana de un vistazo: minutos y carga por día --- */}

                  {vistazo.some((dia) => dia.minutos > 0) && (
                    <div className="mt-4">
                      <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
                        La semana de un vistazo · carga = tiempo × intensidad
                      </p>

                      <div className="flex items-end gap-2 overflow-x-auto pb-1">
                        {vistazo.map((dia) => (
                          <div key={dia.fecha} className="flex w-16 shrink-0 flex-col items-center gap-1">
                            <span className="text-[10px] tabular-nums text-white/55">
                              {dia.libre ? "—" : dia.carga || ""}
                            </span>

                            <div className="flex h-20 w-6 items-end rounded bg-white/[0.04]">
                              <div
                                className="w-full rounded"
                                style={{
                                  height: `${(dia.carga / cargaMaxima) * 100}%`,
                                  background: /^MD$/i.test(dia.md.trim()) ? "#C8A96B" : "rgb(52 211 153 / .6)",
                                }}
                              />
                            </div>

                            <span className="text-[10px] font-semibold text-white/70">{dia.md || "¿MD?"}</span>

                            <span className="text-[10px] tabular-nums text-white/40">
                              {dia.libre ? "libre" : `${dia.minutos}′`}
                              {dia.abp > 0 ? ` · ${dia.abp}′ ABP` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* --- Copiar otra semana: la mitad del trabajo --- */}

                  <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-white/[0.07] px-3 py-3">
                    <ClipboardCopy size={15} className="mb-2.5 shrink-0 text-white/35" aria-hidden />

                    <div className="min-w-[240px] flex-1">
                      <Select
                        label="Copiar la estructura de otro microciclo"
                        value=""
                        options={[
                          { value: "", label: "Elige uno…" },
                          ...[...(registro?.micros ?? [])]
                            .sort((a, b) => b.micro - a.micro)
                            .map((uno) => ({
                              value: String(uno.micro),
                              label: `Micro ${uno.micro} · ${uno.rival || "sin rival"} (${uno.tareas} tareas)`,
                            })),
                        ]}
                        onChange={(valor) => {
                          if (valor) copiaDe(Number(valor));
                        }}
                      />
                    </div>

                    <p className="mb-2 min-w-[240px] flex-[2] text-[11px] leading-relaxed text-white/35">
                      Trae sus tareas atadas por MD —el MD-2 de aquella semana al MD-2 de ésta— con
                      su tipo, sus contenidos y sus tiempos. Lo que no encuentre pareja se queda
                      como está, y los días libres siguen libres.
                    </p>
                  </div>

                  {yaEnLaHoja && editando === null && (
                    <div className="mt-3">
                      <Notice
                        tone="warn"
                        title={`El microciclo ${micro.micro} ya existe en la hoja`}
                      >
                        <label className="flex items-center gap-2 text-[12px] text-white/60">
                          <input
                            type="checkbox"
                            checked={reemplazar}
                            onChange={(event) => setReemplazar(event.target.checked)}
                            className="h-3.5 w-3.5 accent-[#C8A96B]"
                          />
                          Borrar sus filas y escribirlas otra vez
                        </label>

                        <button
                          type="button"
                          onClick={() => void abreParaEditar(micro.micro)}
                          className="mt-2 text-[12px] text-[#C8A96B] hover:underline"
                        >
                          O ábrelo de la hoja para editarlo
                        </button>
                      </Notice>
                    </div>
                  )}
                </Panel>

                {/* --------------------- LAS SESIONES --------------------- */}

                {micro.sesiones.map((sesion, indice) => {
                  const suyos = cuentas.porFecha[sesion.fecha] ?? 0;

                  const corta =
                    sesion.tareas.length > 0 && suyos > 0 && suyos < MINUTOS_HABITUALES.minimo;

                  const larga = suyos > MINUTOS_HABITUALES.maximo;

                  return (
                    <Panel
                      key={sesion.fecha}
                      title={etiquetaDia(sesion.fecha)}
                      subtitle={
                        sesion.libre
                          ? `${sesion.md} · día libre`
                          : sesion.tareas.length === 0
                          ? `${sesion.md} · sin sesión`
                          : `${sesion.md} · ${sesion.tareas.length} tarea(s) · ${suyos}′${
                              corta ? " (corta para lo habitual)" : larga ? " (larga)" : ""
                            }`
                      }
                      action={
                        <div className="flex gap-2">
                          <Button
                            icon={Plus}
                            onClick={() =>
                              cambiaSesion(indice, {
                                tareas: [
                                  ...sesion.tareas,
                                  tareaVacia(sesion.dia, sesion.tareas.length + 1),
                                ],
                              })
                            }
                          >
                            Tarea
                          </Button>

                          {!sesion.libre && !/^MD$/i.test(sesion.md.trim()) && (
                            <Button
                              icon={Moon}
                              onClick={() => cambiaLibre(sesion.fecha, true)}
                              title="Día libre: no se escribe ninguna fila"
                            >
                              Libre
                            </Button>
                          )}
                        </div>
                      }
                    >
                      <div className="mb-3 grid gap-2 md:grid-cols-4">
                        {sesion.rival !== undefined && (
                          <Field
                            label="Rival de este día"
                            value={sesion.rival}
                            onChange={(v) => cambiaSesion(indice, { rival: v })}
                            hint="Este microciclo abarca otro partido"
                          />
                        )}

                        <Field
                          label="MD"
                          value={sesion.md}
                          onChange={(v) => cambiaSesion(indice, { md: v.toUpperCase() })}
                        />

                        <Field
                          label="Día"
                          value={sesion.dia}
                          onChange={(v) =>
                            cambiaSesion(indice, { dia: v.toUpperCase().slice(0, 1) })
                          }
                          hint="L, M, X, J, V, S o D"
                        />

                        <Field
                          label="Fecha"
                          type="date"
                          value={sesion.fecha}
                          onChange={(v) => cambiaSesion(indice, { fecha: v, dia: /^\d{4}-\d{2}-\d{2}$/.test(v) ? diaKeyDe(v) : sesion.dia })}
                        />
                      </div>

                      {sesion.libre ? (
                        <p className="flex flex-wrap items-center gap-2 text-[12px] text-white/45">
                          <Moon size={13} aria-hidden /> Día libre: no se escribe ninguna fila.
                          <button
                            type="button"
                            onClick={() => cambiaLibre(sesion.fecha, false)}
                            className="rounded-md px-1.5 py-0.5 text-[#C8A96B] hover:bg-[#C8A96B]/10"
                          >
                            Entrenar este día
                          </button>
                        </p>
                      ) : sesion.tareas.length === 0 ? (
                        <p className="text-[12px] text-white/35">
                          Día sin sesión: no se escribe ninguna fila. Con «Tarea» se añade una.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {sesion.tareas.map((tarea, j) => (
                            <FilaTarea
                              key={`${sesion.fecha}-${j}`}
                              tarea={tarea}
                              sugerencias={sugerencias}
                              onCambia={(cambio) => cambiaTarea(indice, j, cambio)}
                              onDuplicar={() =>
                                cambiaSesion(indice, {
                                  tareas: [
                                    ...sesion.tareas.slice(0, j + 1),
                                    copiaDeTarea(tarea),
                                    ...sesion.tareas.slice(j + 1),
                                  ],
                                })
                              }
                              onQuitar={() =>
                                cambiaSesion(indice, {
                                  tareas: sesion.tareas.filter((_, k) => k !== j),
                                })
                              }
                              onSubir={j > 0 ? () => mueveTarea(indice, j, j - 1) : undefined}
                              onBajar={
                                j < sesion.tareas.length - 1
                                  ? () => mueveTarea(indice, j, j + 1)
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      )}
                    </Panel>
                  );
                })}

                {/* --------------------- ESCRIBIR --------------------- */}

                <Panel
                  title="Escribir en la hoja"
                  subtitle={`${filas.length} fila(s) · microciclo ${micro.micro} · ${micro.rival}`}
                  icon={Upload}
                  action={
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => setRevisar((abierto) => !abierto)}>
                        {revisar ? "Ocultar" : "Revisar"}
                      </Button>

                      <Button
                        tone="primary"
                        icon={Upload}
                        disabled={guardando || !listo}
                        onClick={() => void guarda()}
                        title={
                          listo
                            ? "Añade las filas al final de la pestaña"
                            : (problemas[0] ??
                              "Marca «rehacerlo» para sustituir lo que ya hay")
                        }
                      >
                        {guardando ? "Escribiendo…" : "Escribir en la hoja"}
                      </Button>
                    </div>
                  }
                >
                  {problemas.length > 0 ? (
                    <Notice tone="warn" title="Antes de escribir">
                      <ul className="space-y-1">
                        {problemas.map((problema) => (
                          <li key={problema}>{problema}</li>
                        ))}
                      </ul>
                    </Notice>
                  ) : (
                    <p className="text-[12px] leading-relaxed text-white/45">
                      {editando !== null
                        ? `Se sustituyen las filas del microciclo ${micro.micro} por estas ${filas.length}, en el mismo sitio de la pestaña, heredando las fórmulas de carga y las listas desplegables.`
                        : `Se añaden ${filas.length} filas al final de la pestaña, clonando la última para heredar las fórmulas de carga y las listas desplegables.`}
                      {enBlanco > 0
                        ? ` ${enBlanco} tarea(s) en blanco —sin tipo, contenido ni tiempo— no se escriben.`
                        : ""}
                      {yaEnLaHoja && reemplazar && editando === null
                        ? ` Antes se borran las del microciclo ${micro.micro} que ya estaban.`
                        : ""}
                    </p>
                  )}

                  {escrito && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-3 py-2.5">
                      <CheckCircle2
                        size={14}
                        className="mt-0.5 shrink-0 text-emerald-300"
                        aria-hidden
                      />

                      <p className="text-[12px] leading-relaxed text-white/70">
                        Escritas <strong className="text-white/90">{escrito.escritas}</strong>{" "}
                        fila(s)
                        {escrito.borradas ? `, borradas ${escrito.borradas}` : ""}. La hoja dice que
                        el microciclo {micro.micro} tiene ahora{" "}
                        <strong className="text-white/90">{escrito.filas}</strong> fila(s).
                      </p>
                    </div>
                  )}

                  {revisar && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-[11px]">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wide text-white/35">
                            <th className="py-1.5 pr-3">Fecha</th>
                            <th className="py-1.5 pr-3">MD</th>
                            <th className="py-1.5 pr-3">Tarea</th>
                            <th className="py-1.5 pr-3">Tipo</th>
                            <th className="py-1.5 pr-3">Fase</th>
                            <th className="py-1.5 pr-3">Contenido</th>
                            <th className="py-1.5 pr-3 text-right">Tiempo</th>
                            <th className="py-1.5 pr-3 text-right">Int.</th>
                            <th className="py-1.5 text-right">Cog.</th>
                          </tr>
                        </thead>

                        <tbody className="text-white/60">
                          {filas.map((fila, indice) => (
                            <tr
                              key={`${String(fila.Tarea)}-${indice}`}
                              className="border-t border-white/[0.06]"
                            >
                              <td className="whitespace-nowrap py-1.5 pr-3">
                                {String(fila.Fecha ?? "")}
                              </td>
                              <td className="py-1.5 pr-3">{String(fila.MD ?? "")}</td>
                              <td className="py-1.5 pr-3 text-white/80">
                                {String(fila.Tarea ?? "")}
                              </td>
                              <td className="py-1.5 pr-3">{String(fila["Tipo Tarea"] ?? "")}</td>
                              <td className="py-1.5 pr-3">{String(fila.Fase ?? "")}</td>
                              <td className="py-1.5 pr-3">
                                {String(fila["Contenido Principal"] ?? "")}
                              </td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">
                                {String(fila.Tiempo ?? "")}
                              </td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">
                                {String(fila["Intensidad (1-5)"] ?? "")}
                              </td>
                              <td className="py-1.5 text-right tabular-nums">
                                {String(fila["Exig.Cog.(1-5)"] ?? "")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-white/30">
                    <ExternalLink size={12} className="mt-0.5 shrink-0" aria-hidden />
                    «Carga Ponderada», «Carga cognitiva» y «Demanda Cognitiva» no se mandan: las
                    calcula la hoja con sus fórmulas. Si contesta que no conoce la acción, falta
                    pegar{" "}
                    <code className="text-white/50">scripts/abp-hoja.gs</code> en el Apps Script
                    del libro de ABP y publicar versión nueva.
                  </p>
                </Panel>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
