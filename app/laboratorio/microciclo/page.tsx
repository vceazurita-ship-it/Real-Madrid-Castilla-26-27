"use client";

/**
 * EN OBRAS · CREAR EL MICROCICLO EN LA HOJA DE REGISTRO.
 *
 * La pestaña de registro de tareas es de donde come todo lo que analiza
 * microciclos —`/microcycles`, la transferencia de Data Análisis, el microciclo
 * de ABP, el calendario de micros—, y hasta ahora sólo se podía rellenar a mano
 * en Google Sheets, fila a fila. Esto la escribe desde aquí.
 *
 * **La semana se arma sola**: los días salen del calendario del Castilla —del
 * día siguiente al partido anterior hasta el próximo— con su MD calculado, y
 * cada día trae sus sesiones. Lo que hay que rellenar es lo de cada tarea.
 *
 * **Lo que NO se manda nunca**: «Carga Ponderada», «Carga cognitiva» y
 * «Demanda Cognitiva». Son fórmulas de la hoja; las filas nuevas se crean
 * clonando la de arriba para heredarlas (y de paso, el formato y las listas
 * desplegables). Ver `scripts/apps-script/registro-tareas.gs`.
 *
 * Está en obras a propósito: escribe en la hoja de verdad, así que primero se
 * mira lo que va a escribir y se pulsa a conciencia.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Copy,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { AbpHeader, Button, Field, Notice, Panel, Select } from "@/components/abp/ui";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { loadRegistro, type RegistroDataset } from "@/lib/abp/registro";
import {
  FASES,
  GRUPOS,
  TIPOS_TAREA,
  filasDelMicro,
  revisaMicro,
  tareaDeCompeticion,
  tareaVacia,
  type MicroNuevo,
  type SesionNueva,
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
import { teamKey } from "@/lib/abp/model";

const DIA_MS = 86_400_000;

const TEMPORADA = "2026 - 2027";

/** Cuántas tareas trae un día recién creado. */
const TAREAS_POR_SESION = 4;

/**
 * Los días del microciclo, del calendario.
 *
 * Del día siguiente al partido anterior hasta el del próximo, los dos
 * incluidos. El día de después del partido se propone vacío —descanso— y el
 * día del partido trae su fila de competición, que es como está escrito en la
 * hoja toda la temporada.
 */
function armaSesiones(proximo: PartidoNuestro, anterior: PartidoNuestro | null): SesionNueva[] {
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
    const clave = diaKeyDe(fecha);

    const md = Math.round(
      (Date.parse(`${partido}T12:00:00Z`) - Date.parse(`${fecha}T12:00:00Z`)) / DIA_MS,
    );

    const esPartido = md === 0;

    const esPostPartido = indice === 0 && Boolean(desde) && ultimos.length > 4;

    return {
      fecha,
      dia: clave,
      md: esPartido ? "MD" : `MD-${md}`,
      tareas: esPartido
        ? [tareaDeCompeticion(clave)]
        : esPostPartido
          ? []
          : Array.from({ length: TAREAS_POR_SESION }, (_, i) => tareaVacia(clave, i + 1)),
    };
  });
}

/* ------------------------------------------------------------------ */
/*  UNA TAREA                                                          */
/* ------------------------------------------------------------------ */

function FilaTarea({
  tarea,
  onCambia,
  onQuitar,
}: {
  tarea: TareaNueva;
  onCambia: (cambio: Partial<TareaNueva>) => void;
  onQuitar: () => void;
}) {
  const [abierta, setAbierta] = useState(false);

  const numero = (valor: string) => Math.max(0, Number(valor) || 0);

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
      <div className="grid gap-2 md:grid-cols-[92px_1fr_1fr_70px_60px_60px_32px] md:items-end">
        <Field label="Tarea" value={tarea.tarea} onChange={(v) => onCambia({ tarea: v })} />

        <Select
          label="Tipo"
          value={tarea.tipoTarea}
          options={["", ...TIPOS_TAREA]}
          onChange={(v) => onCambia({ tipoTarea: v })}
        />

        <Select
          label="Fase"
          value={tarea.fase}
          options={["", ...FASES]}
          onChange={(v) => onCambia({ fase: v })}
        />

        <Field
          label="Tiempo"
          type="number"
          value={tarea.tiempo ? String(tarea.tiempo) : ""}
          onChange={(v) => onCambia({ tiempo: numero(v) })}
        />

        <Field
          label="Int."
          type="number"
          value={tarea.intensidad ? String(tarea.intensidad) : ""}
          onChange={(v) => onCambia({ intensidad: Math.min(5, numero(v)) })}
        />

        <Field
          label="Cog."
          type="number"
          value={tarea.exigCog ? String(tarea.exigCog) : ""}
          onChange={(v) => onCambia({ exigCog: Math.min(5, numero(v)) })}
        />

        <button
          type="button"
          onClick={onQuitar}
          title="Quitar esta tarea"
          className="mb-1 flex h-9 w-8 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/[0.06] hover:text-rose-300"
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <Field
          label="Contenido principal"
          value={tarea.contenidoPrincipal}
          onChange={(v) => onCambia({ contenidoPrincipal: v })}
          placeholder="Mantener posesión - press pérdida"
        />

        <Field
          label="Contenido secundario"
          value={tarea.contenidoSecundario}
          onChange={(v) => onCambia({ contenidoSecundario: v })}
        />
      </div>

      <button
        type="button"
        onClick={() => setAbierta((abierto) => !abierto)}
        className="mt-2 flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-white/35 transition hover:text-white/60"
      >
        {abierta ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
        Lo que alimenta la demanda cognitiva
      </button>

      {abierta && (
        <div className="mt-2 grid gap-2 md:grid-cols-4">
          <Field
            label="Formato"
            value={tarea.formato}
            onChange={(v) => onCambia({ formato: v })}
            placeholder="8v8+6"
          />

          <Select
            label="Grupo"
            value={tarea.grupo}
            options={GRUPOS}
            onChange={(v) => onCambia({ grupo: v })}
          />

          <Field
            label="Densidad"
            type="number"
            value={tarea.densidad ? String(tarea.densidad) : ""}
            onChange={(v) => onCambia({ densidad: numero(v) })}
          />

          <Field
            label="Nº jugadores en la tarea"
            type="number"
            value={tarea.nJug ? String(tarea.nJug) : ""}
            onChange={(v) => onCambia({ nJug: numero(v) })}
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

          <div className="md:col-span-3">
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
/*  LA PÁGINA                                                          */
/* ------------------------------------------------------------------ */

export default function EditorMicrocicloPage() {
  const [registro, setRegistro] = useState<RegistroDataset | null>(null);

  const [calendario, setCalendario] = useState<PartidoCastilla[]>([]);

  const [cargando, setCargando] = useState(true);

  /* Se ha intentado leer el calendario y no ha venido nada. */
  const sinCalendario = !cargando && calendario.length === 0;

  const [micro, setMicro] = useState<MicroNuevo | null>(null);

  /* Lo que dice el calendario: se resuelve al cargar, no en cada render. */
  const [partido, setPartido] = useState<{
    proximo: PartidoNuestro | null;
    anterior: PartidoNuestro | null;
  }>({ proximo: null, anterior: null });

  const [reemplazar, setReemplazar] = useState(false);

  const [guardando, setGuardando] = useState(false);

  const [escrito, setEscrito] = useState<{ escritas: number; borradas: number } | null>(null);

  /* Las dos fuentes: la hoja (para saber qué micros hay) y el calendario. */
  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      const [datos, partidos] = await Promise.all([
        loadRegistro().catch(() => null),
        fetch("/api/docs?key=" + encodeURIComponent(CLAVE_CALENDARIO), { cache: "no-store" })
          .then((r) => r.json() as Promise<{ data?: { partidos?: PartidoCastilla[] } }>)
          .then((leido) => leido?.data?.partidos ?? [])
          .catch(() => [] as PartidoCastilla[]),
      ]);

      if (cancelado) return;

      /*
      | La primera propuesta se arma aquí, con el calendario recién leído.
      |
      | Es el sitio: el linter no deja llamar a Date.now() en el cuerpo del
      | componente ni hacer setState desde un efecto que mire al estado, y
      | esto es exactamente «traigo algo de fuera y lo dejo puesto».
      */
      const alrededor = alrededorDe(partidos, Date.now());

      const ultimo = (datos?.micros ?? []).reduce(
        (mayor, uno) => Math.max(mayor, uno.micro),
        0,
      );

      /*
      | El primer partido que TODAVÍA no tiene microciclo.
      |
      | Casi siempre es el próximo, pero cuando la semana en curso ya está
      | escrita en la hoja —como el 20/09/2026, con el micro del Sant Andreu
      | hecho— lo que toca crear es el siguiente. Arrancar en el de siempre
      | proponía el micro 14 con el partido del 13, que no es lo que nadie
      | quiere escribir.
      */
      const hechos = new Set(
        (datos?.micros ?? [])
          .map((uno) => teamKey(uno.rival))
          .filter((clave) => clave.length > 0),
      );

      const pendientes = alrededor.proximo
        ? alrededor.todos.filter(
            (uno) => uno.cuando >= (alrededor.proximo?.cuando ?? ""),
          )
        : [];

      const objetivo =
        pendientes.find((uno) => !hechos.has(teamKey(uno.rival))) ??
        alrededor.proximo;

      const previo = objetivo
        ? [...alrededor.todos]
            .filter((uno) => uno.cuando < objetivo.cuando)
            .slice(-1)[0] ?? null
        : null;

      setRegistro(datos);
      setCalendario(partidos);
      setPartido({ proximo: objetivo, anterior: previo });

      if (objetivo) {
        setMicro({
          temporada: TEMPORADA,
          micro: ultimo + 1,
          rival: objetivo.rival.toUpperCase(),
          sesiones: armaSesiones(objetivo, previo),
        });
      }

      setCargando(false);
    };

    void cargar();

    return () => {
      cancelado = true;
    };
  }, []);

  const { proximo, anterior } = partido;

  const ultimoMicro = useMemo(
    () => registro?.micros.reduce((mayor, uno) => Math.max(mayor, uno.micro), 0) ?? 0,
    [registro],
  );

  /** Arma el microciclo con lo que dice el calendario. */
  const arma = useCallback(
    (numero: number) => {
      if (!proximo) return;

      setMicro({
        temporada: TEMPORADA,
        micro: numero,
        rival: proximo.rival.toUpperCase(),
        sesiones: armaSesiones(proximo, anterior),
      });

      setEscrito(null);
    },
    [proximo, anterior],
  );

  const yaEnLaHoja = useMemo(
    () => registro?.micros.some((uno) => uno.micro === micro?.micro) ?? false,
    [registro, micro],
  );

  const filas = useMemo(() => (micro ? filasDelMicro(micro) : []), [micro]);

  const problemas = useMemo(() => (micro ? revisaMicro(micro) : []), [micro]);

  const cambiaSesion = (indice: number, cambio: Partial<SesionNueva>) =>
    setMicro((actual) =>
      actual
        ? {
            ...actual,
            sesiones: actual.sesiones.map((sesion, i) =>
              i === indice ? { ...sesion, ...cambio } : sesion,
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
      };

      if (!respuesta.ok || !datos.ok) throw new Error(datos.error ?? `HTTP ${respuesta.status}`);

      setEscrito({ escritas: datos.escritas ?? filas.length, borradas: datos.borradas ?? 0 });

      toast.success(`${datos.escritas ?? filas.length} fila(s) escritas`, {
        id: aviso,
        description: "La hoja tarda unos minutos en refrescar el CSV que leen las pantallas.",
      });
    } catch (error) {
      toast.error("No se ha podido escribir", {
        id: aviso,
        description: error instanceof Error ? error.message : "Inténtalo otra vez",
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="mx-auto min-w-0 max-w-[1500px] px-4 py-6 md:px-8 md:py-8">
          <AbpHeader
            area="RMCF Castilla · En obras"
            title="Crear el microciclo en la hoja"
            lead="Arma la semana con el calendario y escribe las filas en la hoja de registro de tareas, con sus fórmulas intactas."
          />

          <div className="mt-6 space-y-5">
            <Notice tone="warn" title="Esto escribe en la hoja de verdad">
              <ul className="space-y-1">
                <li>
                  Las filas nuevas se crean <strong className="text-white/75">clonando la
                  última</strong>, para heredar las fórmulas de carga y las listas desplegables.
                  «Carga Ponderada», «Carga cognitiva» y «Demanda Cognitiva» no se mandan: las
                  calcula la hoja.
                </li>

                <li>
                  Hace falta tener pegado{" "}
                  <code className="text-white/60">scripts/apps-script/registro-tareas.gs</code> en
                  el editor de Apps Script de la hoja. Si no lo está, el botón lo dirá.
                </li>

                <li>
                  Las pantallas que leen el CSV publicado (
                  <strong className="text-white/75">/microcycles</strong> y la transferencia de
                  Data Análisis) tardan unos minutos en ver lo nuevo.
                </li>
              </ul>
            </Notice>

            {cargando && <p className="text-[12px] text-white/40">Leyendo la hoja y el calendario…</p>}

            {sinCalendario && !proximo && (
              <Notice tone="warn" title="No sé cuándo es el próximo partido">
                El calendario del Castilla lo baja de BeSoccer el ordenador del club. Sin él no se
                puede armar la semana; se puede crear a mano en la hoja como siempre.
              </Notice>
            )}

            {micro && proximo && (
              <>
                <Panel
                  title="Qué microciclo"
                  subtitle="El número, el rival y los días salen del calendario; se pueden cambiar"
                  icon={CalendarClock}
                  action={
                    <Button icon={RefreshCw} onClick={() => arma(micro.micro)}>
                      Rehacer los días
                    </Button>
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
                      suggestions={["NO COMPETICIÓN"]}
                    />

                    <div className="text-[11px] leading-relaxed text-white/45">
                      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                        Partido
                      </span>

                      J{proximo.jornada} · {proximo.rival} ·{" "}
                      {proximo.lado === "casa" ? "en casa" : "fuera"}
                      <br />
                      {new Date(proximo.cuando).toLocaleString("es-ES", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>

                  {yaEnLaHoja && (
                    <div className="mt-3">
                      <Notice tone="warn" title={`El microciclo ${micro.micro} ya existe en la hoja`}>
                        <label className="flex items-center gap-2 text-[12px] text-white/60">
                          <input
                            type="checkbox"
                            checked={reemplazar}
                            onChange={(event) => setReemplazar(event.target.checked)}
                            className="h-3.5 w-3.5 accent-[#C8A96B]"
                          />
                          Borrar sus filas y escribirlas otra vez
                        </label>
                      </Notice>
                    </div>
                  )}
                </Panel>

                {micro.sesiones.map((sesion, indice) => (
                  <Panel
                    key={sesion.fecha}
                    title={etiquetaDia(sesion.fecha)}
                    subtitle={`${sesion.md} · ${sesion.tareas.length} tarea(s)`}
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

                        {sesion.tareas.length > 0 && (
                          <Button icon={Trash2} onClick={() => cambiaSesion(indice, { tareas: [] })}>
                            Descanso
                          </Button>
                        )}
                      </div>
                    }
                  >
                    <div className="mb-3 grid gap-2 md:grid-cols-4">
                      <Field
                        label="MD"
                        value={sesion.md}
                        onChange={(v) => cambiaSesion(indice, { md: v })}
                      />

                      <Field
                        label="Día"
                        value={sesion.dia}
                        onChange={(v) => cambiaSesion(indice, { dia: v.toUpperCase().slice(0, 1) })}
                      />

                      <Field
                        label="Fecha"
                        value={sesion.fecha}
                        onChange={(v) => cambiaSesion(indice, { fecha: v })}
                        hint="Se escribe como fecha, no como texto"
                      />
                    </div>

                    {sesion.tareas.length === 0 ? (
                      <p className="text-[12px] text-white/35">
                        Día sin sesión: no se escribe ninguna fila.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {sesion.tareas.map((tarea, j) => (
                          <FilaTarea
                            key={`${sesion.fecha}-${j}`}
                            tarea={tarea}
                            onCambia={(cambio) => cambiaTarea(indice, j, cambio)}
                            onQuitar={() =>
                              cambiaSesion(indice, {
                                tareas: sesion.tareas.filter((_, k) => k !== j),
                              })
                            }
                          />
                        ))}
                      </div>
                    )}
                  </Panel>
                ))}

                <Panel
                  title="Escribir en la hoja"
                  subtitle={`${filas.length} fila(s) · microciclo ${micro.micro} · ${micro.rival}`}
                  icon={Upload}
                  action={
                    <Button
                      tone="primary"
                      icon={Upload}
                      disabled={guardando || problemas.length > 0 || (yaEnLaHoja && !reemplazar)}
                      onClick={() => void guarda()}
                    >
                      {guardando ? "Escribiendo…" : "Escribir en la hoja"}
                    </Button>
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
                      Se añaden {filas.length} filas al final de la pestaña, clonando la última para
                      heredar fórmulas y validaciones.
                      {yaEnLaHoja && reemplazar
                        ? ` Antes se borran las del microciclo ${micro.micro} que ya estaban.`
                        : ""}
                    </p>
                  )}

                  {escrito && (
                    <p className="mt-3 text-[12px] text-emerald-300">
                      Escritas {escrito.escritas} fila(s)
                      {escrito.borradas ? `, borradas ${escrito.borradas}` : ""}. Abre la hoja para
                      revisarlas.
                    </p>
                  )}

                  <details className="mt-3">
                    <summary className="cursor-pointer text-[11px] uppercase tracking-[0.16em] text-white/35">
                      Ver lo que se va a mandar
                    </summary>

                    <pre className="mt-2 max-h-[280px] overflow-auto rounded-xl bg-black/30 p-3 text-[10px] leading-relaxed text-white/50">
                      {JSON.stringify(filas, null, 1)}
                    </pre>
                  </details>

                  <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-white/30">
                    <Copy size={12} className="mt-0.5 shrink-0" aria-hidden />
                    Si la hoja contesta que no conoce la acción, falta pegar
                    <code className="mx-1 text-white/50">scripts/apps-script/registro-tareas.gs</code>
                    en Apps Script y volver a publicar el despliegue.
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
