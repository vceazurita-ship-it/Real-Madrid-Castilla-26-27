"use client";

/**
 * La semana de lunes a domingo.
 *
 * Siete columnas, una por día, con lo que se trabaja de balón parado en cada
 * una. La rejilla no se apila en móvil: se desplaza en horizontal. Un
 * microciclo se lee comparando los días entre sí —dónde está la carga, qué día
 * queda vacío— y en una lista vertical de siete bloques eso se pierde.
 *
 * Los bloques se mueven arrastrando: de un día a otro y dentro del mismo día.
 * Replanificar una semana es sobre todo mover cosas de sitio —«esto lo paso al
 * MD-2»— y hacerlo abriendo el diálogo y cambiando el conmutador de día
 * costaba cuatro toques por bloque. Cada ficha lleva además duplicar y quitar,
 * que son los otros dos gestos de replanificar.
 *
 * El arrastre usa el mismo montaje que la pizarra de sesión: `PointerSensor`
 * con distancia mínima —para que un toque siga abriendo la ficha— y
 * `TouchSensor` con retardo, que es lo que separa arrastrar de desplazar la
 * rejilla en tablet.
 *
 * ---
 *
 * **La ficha lo cuenta todo.** Un microciclo se comparte por pantallazo con
 * gente que no entra en la app —el resto del cuerpo técnico, el club— y con
 * la ficha recortada («Córner dir. +1», la nota cortada a media palabra) el
 * que lo recibía no podía saber qué se iba a trabajar. Así que la ficha lleva
 * los aspectos con su nombre entero, los dos lados si son dos, el momento, si
 * es campo o vídeo, con quién se trabaja, la nota completa y el desgaste.
 *
 * El conmutador «Compacta» devuelve la ficha corta de antes: para replanificar
 * a mano —arrastrar seis bloques de un día a otro— caben más días a la vez.
 */

import { useState, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Copy, Monitor, Plus, Trash2 } from "lucide-react";

import { chipInk } from "@/lib/theme";
import { useTextosExplicativos } from "@/components/ui/textos-analisis";
import { porqueDe } from "@/lib/abp/semana-revision";

import {
  DIAS,
  DIA_KEYS,
  LADO_COLOR,
  LADO_LABEL,
  LADO_SHORT,
  MOMENTO_SHORT,
  ROL_LABEL,
  ROL_SHORT,
  TIPOS_DIA,
  aspectosDe,
  cargaCognitiva,
  cargaCondicional,
  etiquetaTrabajo,
  fmtMin,
  ladosDe,
  type AbpLado,
  type DiaKey,
  type PlanDia,
  type TipoDia,
  type Trabajo,
} from "@/lib/abp/microciclo";

/* ------------------------------------------------------------------ */
/*  IDENTIDADES DEL ARRASTRE                                           */
/* ------------------------------------------------------------------ */

/*
| Tres registros distintos con ids propios: el bloque que se arrastra, la
| columna entera —soltar ahí lo pone al final— y el hueco de delante de cada
| bloque, que es lo que permite ordenar dentro de un día. Los prefijos evitan
| que dos días con el mismo trabajo (una copia) compartan id.
*/
const idBloque = (dia: DiaKey, trabajo: string) => `bloque:${dia}:${trabajo}`;
const idColumna = (dia: DiaKey) => `columna:${dia}`;
const idHueco = (dia: DiaKey, trabajo: string) => `hueco:${dia}:${trabajo}`;

const ROTULO_TIPO: Record<TipoDia, string> = {
  entreno: "Sesión",
  descanso: "Libre",
  partido: "Partido",
};

type DatosArrastre = { dia: DiaKey; id: string };
type DatosDestino = { dia: DiaKey; antesDe: string | null };

/*
| La franja de color del canto izquierdo dice el lado sin gastar una línea.
| Con los dos lados marcados se parte en dos: verde arriba, rojo abajo. Un
| color mezclado —un amarillo a medio camino— no diría «los dos», diría otra
| cosa.
*/
function franjaDeLados(lados: AbpLado[]) {
  if (lados.length < 2) return LADO_COLOR[lados[0]];

  return `linear-gradient(180deg, ${LADO_COLOR.ofensivo} 0 50%, ${LADO_COLOR.defensivo} 50% 100%)`;
}

/** «Sacadores», «Sacadores y rematadores», «A, B y C». */
function enLista(partes: string[]) {
  if (partes.length <= 1) return partes[0] ?? "";

  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

/* ------------------------------------------------------------------ */
/*  FICHA DE UN TRABAJO                                                */
/* ------------------------------------------------------------------ */

/** El contenido de la ficha, sin nada de arrastre: lo comparte el fantasma. */
function TrabajoCuerpo({
  trabajo,
  detalle,
}: {
  trabajo: Trabajo;
  /** Ficha completa (la de compartir) o corta (la de replanificar). */
  detalle: boolean;
}) {
  const lados = ladosDe(trabajo);
  const aspectos = aspectosDe(trabajo);

  /*
  | La nota que escribe el boceto («Boceto · urgencia 33/100…») cuenta cómo se
  | propuso el trabajo: es método, sólo con los textos explicativos (14/10/2026).
  | Lo escrito a mano en la nota se ve siempre.
  */
  const explicativos = useTextosExplicativos();

  /* El porqué del boceto se ve siempre, como «Por qué» (21/10/2026). */
  const { porque, resto: notas } = porqueDe(trabajo.notas, explicativos);

  const desgaste = [
    trabajo.intensidad > 0 ? `intensidad ${trabajo.intensidad}/10` : "",
    trabajo.exigCognitiva > 0 ? `cognitiva ${trabajo.exigCognitiva}/10` : "",
  ].filter(Boolean);

  return (
    <>
      <div className="flex items-start justify-between gap-1.5">
        {/* En detalle el nombre se parte en varias líneas en vez de cortarse:
            «Falta lateral indirecta» no cabe entera en una columna. */}
        <p
          className={`min-w-0 flex-1 text-[11.5px] font-semibold text-white ${
            detalle ? "leading-snug" : "truncate leading-tight"
          }`}
        >
          {/* Dos aspectos como mucho y «y N más» (21/10/2026): cinco seguidos
              ocupaban ocho líneas en una columna estrecha. */}
          {detalle ? (
            <span title={aspectos.map((aspecto) => aspecto.label).join(" · ")}>
              {aspectos
                .slice(0, 2)
                .map((aspecto) => aspecto.label)
                .join(" · ")}
              {aspectos.length > 2 && (
                <span className="font-medium text-white/45"> y {aspectos.length - 2} más</span>
              )}
            </span>
          ) : (
            etiquetaTrabajo(trabajo, true)
          )}
        </p>

        {trabajo.minutos > 0 && (
          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-white/70">
            {trabajo.minutos}′
          </span>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {/* La chapa «Sin tiempo» se quitó el 21/10/2026: el hueco ya lo
            avisa la revisión de la semana, y decirlo tres veces era ruido. */}
        {lados.map((lado) => (
          <span
            key={lado}
            className="rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide"
            style={{
              backgroundColor: `${LADO_COLOR[lado]}22`,
              color: chipInk(LADO_COLOR[lado]),
            }}
            title={LADO_LABEL[lado]}
          >
            {detalle ? LADO_LABEL[lado].toUpperCase() : LADO_SHORT[lado]}
          </span>
        ))}

        <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[11px] font-semibold text-white/55">
          {MOMENTO_SHORT[trabajo.momento]}
        </span>

        {trabajo.medio === "video" ? (
          <span
            className="inline-flex items-center gap-0.5 rounded bg-sky-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-sky-300"
            title="Trabajo en vídeo"
          >
            <Monitor size={9} />
            VÍDEO
          </span>
        ) : (
          detalle && (
            <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[11px] font-semibold text-white/40">
              CAMPO
            </span>
          )
        )}

        {!detalle &&
          trabajo.roles.map((rol) => (
            <span
              key={rol}
              className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[11px] font-semibold text-white/50"
            >
              {ROL_SHORT[rol]}
            </span>
          ))}

        {trabajo.origen === "registro" && (
          <span
            className="rounded bg-emerald-400/12 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300/80"
            title="Importado de la hoja de registro de tareas"
          >
            HOJA
          </span>
        )}
      </div>

      {/*
      | Con quién, la nota entera y el desgaste. En detalle van como texto y no
      | como más etiquetas: ocho chapitas en una columna de 170 px se leen
      | peor que dos renglones.
      */}
      {detalle && trabajo.roles.length > 0 && (
        <p className="mt-1 text-[11px] leading-snug text-white/45">
          Con {enLista(trabajo.roles.map((rol) => ROL_LABEL[rol].toLowerCase()))}
        </p>
      )}

      {notas &&
        (detalle ? (
          <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-snug text-white/60">
            {notas}
          </p>
        ) : (
          <p className="mt-1 truncate text-[11px] text-white/35">
            {notas}
          </p>
        ))}

      {detalle && trabajo.objetivo?.trim() && (
        <p className="mt-1 text-[11px] leading-snug text-white/60">
          <span className="font-semibold text-emerald-300">Éxito · </span>
          {/* Sin siglas en la ficha (30/10/2026): «MdJ» → «modelo de juego». */}
          {trabajo.objetivo.trim().replace(/\bMdJ\b/g, "modelo de juego")}
        </p>
      )}

      {detalle && porque && (
        <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-white/50" title={porque}>
          <span className="font-semibold" style={{ color: "var(--rmcf-gold-ink)" }}>
            Por qué ·{" "}
          </span>
          {porque}
        </p>
      )}

      {detalle && desgaste.length > 0 && (
        <p className="mt-1 text-[9.5px] leading-snug tabular-nums text-white/35">
          {enLista(desgaste).replace(/^./, (letra) => letra.toUpperCase())}
        </p>
      )}
    </>
  );
}

function TrabajoCard({
  dia,
  trabajo,
  detalle,
  onClick,
  onDuplicar,
  onBorrar,
}: {
  dia: DiaKey;
  trabajo: Trabajo;
  detalle: boolean;
  onClick: () => void;
  onDuplicar: () => void;
  onBorrar: () => void;
}) {
  const franja = franjaDeLados(ladosDe(trabajo));

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: idBloque(dia, trabajo.id),
    data: { dia, id: trabajo.id } satisfies DatosArrastre,
  });

  /* El hueco de DELANTE de esta ficha: soltar aquí la coloca antes. */
  const { setNodeRef: huecoRef, isOver } = useDroppable({
    id: idHueco(dia, trabajo.id),
    data: { dia, antesDe: trabajo.id } satisfies DatosDestino,
  });

  return (
    <div ref={huecoRef} className="relative min-w-0">
      {/* La barra que marca dónde va a caer lo que se arrastra. */}
      {isOver && (
        <span className="pointer-events-none absolute -top-1 left-0 right-0 h-0.5 rounded-full bg-[#C8A96B]" />
      )}

      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`group relative w-full min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-2 pl-2.5 text-left transition hover:border-white/25 hover:bg-white/[0.06] ${
          isDragging ? "opacity-30" : ""
        }`}
        style={{ touchAction: "none" }}
      >
        {/* El canto de color: entero si es de un lado, partido si es de los
            dos. Va como capa y no como `borderLeft` porque un borde no puede
            llevar degradado. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
          style={{ background: franja }}
        />

        {/*
        | La ficha entera es el asa de arrastre —en una columna de 130 px no
        | cabe un asa aparte— y por eso abrir es un botón interior que ocupa
        | todo. Con la distancia mínima del sensor, un toque abre y un
        | desplazamiento arrastra.
        */}
        <button
          type="button"
          onClick={onClick}
          className="block w-full min-w-0 text-left"
          title={`${etiquetaTrabajo(trabajo)} · ${trabajo.minutos}′`}
        >
          <TrabajoCuerpo trabajo={trabajo} detalle={detalle} />
        </button>

{/*
        | Duplicar y quitar. Van en su propia fila y no encima de la ficha:
        | flotando abajo a la derecha tapaban el final de la nota, que es donde
        | está escrito lo que se hace en la tarea. Y van siempre visibles en vez
        | de salir al pasar el ratón, porque esto se usa en tablet.
        |
        | `stopPropagation` en el `pointerdown` para que empezar a pulsarlos no
        | se lea como el principio de un arrastre.
        */}
        <div className="mt-1 flex justify-end gap-0.5">
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onDuplicar}
            title="Duplicar este bloque"
            aria-label="Duplicar este bloque"
            className="inline-flex items-center justify-center rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white max-sm:h-8 max-sm:w-8"
          >
            <Copy size={11} />
          </button>

          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onBorrar}
            title="Quitar este bloque"
            aria-label="Quitar este bloque"
            className="inline-flex items-center justify-center rounded-md p-1 text-white/40 transition hover:bg-rose-500/15 hover:text-rose-300 max-sm:h-8 max-sm:w-8"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  COLUMNA DE UN DÍA                                                  */
/* ------------------------------------------------------------------ */

function DiaColumna({
  dia,
  plan,
  detalle,
  etiqueta,
  maximo,
  onCambiaTipo,
  onCambiaMd,
  onAbrir,
  onAnadir,
  onDuplicar,
  onBorrar,
}: {
  dia: DiaKey;
  plan: PlanDia;
  detalle: boolean;
  /** Los minutos del día más cargado de la semana. */
  maximo: number;
  /** "dom 20": la fecha real de ese día en este microciclo. */
  etiqueta?: string;
  onCambiaTipo: (tipo: TipoDia) => void;
  onCambiaMd: (md: string) => void;
  onAbrir: (trabajo: Trabajo) => void;
  onAnadir: () => void;
  onDuplicar: (trabajo: Trabajo) => void;
  onBorrar: (trabajo: Trabajo) => void;
}) {
  const info = DIAS.find((item) => item.key === dia);

  const minutos = plan.trabajos.reduce(
    (total, trabajo) => total + (trabajo.minutos || 0),
    0,
  );

  const carga = plan.trabajos.reduce(
    (total, trabajo) => total + cargaCondicional(trabajo),
    0,
  );

  const cargaCog = plan.trabajos.reduce(
    (total, trabajo) => total + cargaCognitiva(trabajo),
    0,
  );

  /* Tareas con minutos pero sin carga calculable (falta la intensidad). */
  const trabajosSinCarga = plan.trabajos.filter(
    (trabajo) => (trabajo.minutos || 0) > 0 && cargaCondicional(trabajo) <= 0,
  );
  const sinCarga = trabajosSinCarga.length;

  const descansa = plan.tipo === "descanso";

  /* Soltar en la columna, fuera de cualquier ficha: va al final del día. */
  const { setNodeRef, isOver } = useDroppable({
    id: idColumna(dia),
    data: { dia, antesDe: null } satisfies DatosDestino,
  });

  return (
    <div
      className={`flex min-w-0 flex-col rounded-2xl border transition ${
        isOver
          ? "border-[#C8A96B]/60 bg-[#C8A96B]/[0.05]"
          : descansa
            ? "border-white/[0.06] bg-white/[0.01]"
            : plan.tipo === "partido"
              ? "border-emerald-400/30 bg-emerald-400/[0.05]"
              : "border-white/10 bg-white/[0.025]"
      }`}
    >
      {/* ---------------------- CABECERA ---------------------- */}

      <div className="border-b border-white/10 px-2.5 py-2">
        <div className="flex items-baseline justify-between gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white">
            {info?.corto}
            {etiqueta && (
              <span className="ml-1 text-[11px] font-normal normal-case tracking-normal text-white/40">
                {etiqueta}
              </span>
            )}
          </p>

          <input
            value={plan.md}
            onChange={(event) => onCambiaMd(event.target.value)}
            placeholder="MD"
            aria-label={`Día de partido de ${info?.label}`}
            className="w-14 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-right text-[12px] uppercase tracking-wide text-[#C8A96B] outline-none transition placeholder:text-white/20 focus:border-[#C8A96B]/50"
          />
        </div>

        {/* Un desplegable a 13 px (21/10/2026): los tres botones a 9,5 px no
            se leían, y a 13 px no caben en una columna de 140. */}
        <select
          value={plan.tipo}
          onChange={(event) => onCambiaTipo(event.target.value as TipoDia)}
          aria-label={`Tipo de día del ${info?.label?.toLowerCase() ?? "día"}`}
          className={`mt-1.5 w-full rounded-md border px-1.5 py-1 text-[13px] font-semibold outline-none transition focus:border-[#C8A96B]/60 ${
            plan.tipo === "entreno"
              ? "border-white/10 bg-white/[0.05] text-white/80"
              : plan.tipo === "partido"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : "border-white/10 bg-white/[0.02] text-white/45"
          }`}
        >
          {TIPOS_DIA.map((tipo) => (
            <option key={tipo.key} value={tipo.key}>
              {ROTULO_TIPO[tipo.key]}
            </option>
          ))}
        </select>

        {/* El perfil de la semana de un vistazo: cuánto balón parado lleva
            cada día frente al más cargado. */}
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]"
          role="img"
          aria-label={`${fmtMin(minutos)} de balón parado`}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round((minutos / maximo) * 100)}%`,
              backgroundColor: "var(--rmcf-gold-ink)",
            }}
          />
        </div>
      </div>

      {/* ---------------------- TRABAJOS ---------------------- */}

      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-1.5 p-2 ${plan.trabajos.length ? "min-h-[64px] md:min-h-[110px]" : "min-h-[40px]"}`}
      >
        {plan.trabajos.map((trabajo) => (
          <TrabajoCard
            key={trabajo.id}
            dia={dia}
            trabajo={trabajo}
            detalle={detalle}
            onClick={() => onAbrir(trabajo)}
            onDuplicar={() => onDuplicar(trabajo)}
            onBorrar={() => onBorrar(trabajo)}
          />
        ))}

        {!plan.trabajos.length && (
          <p className="px-1 py-2 text-center text-[13px] leading-snug text-white/45">
            {descansa ? "Descanso" : plan.tipo === "partido" ? "Día de partido" : "Sin balón parado"}
          </p>
        )}

        <button
          type="button"
          onClick={onAnadir}
          className="mt-auto inline-flex items-center justify-center gap-1 rounded-xl border border-dashed border-white/12 px-2 py-1.5 text-[11px] font-medium text-white/40 transition hover:border-[#C8A96B]/50 hover:text-[#C8A96B]"
        >
          <Plus size={11} />
          Añadir
        </button>
      </div>

      {/* ----------------------- TOTALES ---------------------- */}

      {minutos > 0 && (
        /* 30/10/2026 (expertos): el pie salta de línea en vez de cortarse
           («carga 18 (») y la fórmula va al lado, en la ⓘ. */
        <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-0.5 border-t border-white/10 px-2.5 py-1.5 text-[11px] tabular-nums">
          <span className="font-semibold text-white/75">{fmtMin(minutos)}</span>

          {(carga > 0 || cargaCog > 0 || sinCarga > 0) && (
            <span className="min-w-0 text-white/50" title="Carga = intensidad × minutos. Cognitiva = exigencia cognitiva × minutos.">
              {[
                carga > 0 ? `carga ${Math.round(carga)}` : "",
                cargaCog > 0 ? `cognitiva ${Math.round(cargaCog)}` : "",
                /* Qué tarea falta de dato, en vez de dejar el hueco. */
                sinCarga > 0
                  ? sinCarga === plan.trabajos.length
                    ? "sin intensidad anotada"
                    : `${trabajosSinCarga.map((trabajo) => fmtMin(trabajo.minutos)).join(" + ")} sin intensidad`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
              {carga > 0 || cargaCog > 0 ? (
                <abbr
                  className="ml-1 cursor-help no-underline"
                  title="Carga = intensidad × minutos. Cognitiva = exigencia cognitiva × minutos."
                  aria-label="Carga: intensidad por minutos. Cognitiva: exigencia cognitiva por minutos."
                >
                  ⓘ
                </abbr>
              ) : null}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SEMANA                                                             */
/* ------------------------------------------------------------------ */

export function SemanaGrid({
  dias,
  orden,
  etiquetas,
  detalle = true,
  onCambiaTipo,
  onCambiaMd,
  onAbrir,
  onAnadir,
  onMover,
  onDuplicar,
  onBorrar,
}: {
  dias: Record<DiaKey, PlanDia>;
  /**
   * Qué días se pintan y en qué orden.
   *
   * Un microciclo **no es una semana natural**: el del Sant Andreu va de
   * domingo a miércoles. Cuando la hoja de registro dice cuáles son sus días,
   * llegan aquí en su orden; sin eso, se pinta la semana de lunes a domingo de
   * siempre.
   */
  orden?: DiaKey[];
  /** La fecha de cada día, para la cabecera ("dom 20"). */
  etiquetas?: Partial<Record<DiaKey, string>>;
  /**
   * Ficha completa —la de compartir— o corta —la de replanificar—. «auto»
   * (21/10/2026): completa salvo en los días con tres o más tareas, que en
   * completa ocupaban columnas larguísimas con el porqué cortado.
   */
  detalle?: boolean | "auto";
  onCambiaTipo: (dia: DiaKey, tipo: TipoDia) => void;
  onCambiaMd: (dia: DiaKey, md: string) => void;
  onAbrir: (dia: DiaKey, trabajo: Trabajo) => void;
  onAnadir: (dia: DiaKey) => void;
  /** `antesDe` es el id del bloque delante del cual cae; `null`, al final. */
  onMover: (
    origen: DiaKey,
    id: string,
    destino: DiaKey,
    antesDe: string | null,
  ) => void;
  onDuplicar: (dia: DiaKey, trabajo: Trabajo) => void;
  onBorrar: (dia: DiaKey, trabajo: Trabajo) => void;
}) {
  /* Lo que se está arrastrando, sólo para pintar el fantasma. */
  const [arrastrando, setArrastrando] = useState<Trabajo | null>(null);

  /*
  | Los días del microciclo, y si no se saben, la semana entera.
  |
  | Se añaden al final los días que no son del microciclo pero tienen trabajo
  | escrito: si alguien puso algo un jueves que ya es de la semana siguiente,
  | esconderlo sería perderlo de vista sin borrarlo.
  */
  const columnas: DiaKey[] = orden?.length
    ? [
        ...orden,
        ...DIA_KEYS.filter(
          (clave) => !orden.includes(clave) && (dias[clave]?.trabajos.length ?? 0) > 0,
        ),
      ]
    : DIA_KEYS;

  /* El día con más minutos: la barra de cada cabecera se mide contra él. */
  const maximoDia = Math.max(
    1,
    ...columnas.map((clave) =>
      (dias[clave]?.trabajos ?? []).reduce((total, trabajo) => total + (trabajo.minutos || 0), 0),
    ),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
  );

  const empieza = (event: DragStartEvent) => {
    const datos = event.active.data.current as DatosArrastre | undefined;

    if (!datos) return;

    setArrastrando(
      dias[datos.dia]?.trabajos.find((item) => item.id === datos.id) ?? null,
    );
  };

  const termina = (event: DragEndEvent) => {
    setArrastrando(null);

    const origen = event.active.data.current as DatosArrastre | undefined;
    const destino = event.over?.data.current as DatosDestino | undefined;

    if (!origen || !destino) return;

    /* Soltarlo sobre sí mismo no es un movimiento. */
    if (destino.antesDe === origen.id) return;

    onMover(origen.dia, origen.id, destino.dia, destino.antesDe);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={empieza}
      onDragEnd={termina}
      onDragCancel={() => setArrastrando(null)}
    >
      {/*
      | En el móvil los días van uno debajo de otro (21/10/2026): siete columnas
      | de 180 px en 390 obligaban a desplazar de lado para encontrar el día, y
      | la barra de cada cabecera ya deja comparar los días entre sí. Desde la
      | tableta, la rejilla de siempre.
      */}
      <div className="pb-1 md:overflow-x-auto">
        {/* La ficha completa necesita columna ancha: con 140 px «Falta lateral
            indirecta» se parte en cuatro renglones. */}
        <div
          className="grid grid-cols-1 items-start gap-2 md:min-w-(--ancho) md:grid-cols-(--columnas)"
          style={
            {
              /* Todas iguales: se probó a estrechar los días libres y de partido
                 y su selector «Sesión · Libre · Partido» ya no cabía. */
              "--columnas": `repeat(${columnas.length}, minmax(0, 1fr))`,
              "--ancho": `${columnas.length * (detalle !== false ? 170 : 140)}px`,
            } as CSSProperties
          }
        >
          {columnas.map((clave) => (
            <DiaColumna
              key={clave}
              dia={clave}
              plan={dias[clave]}
              detalle={detalle === "auto" ? dias[clave].trabajos.length < 3 : detalle}
              etiqueta={etiquetas?.[clave]}
              maximo={maximoDia}
              onCambiaTipo={(tipo) => onCambiaTipo(clave, tipo)}
              onCambiaMd={(md) => onCambiaMd(clave, md)}
              onAbrir={(trabajo) => onAbrir(clave, trabajo)}
              onAnadir={() => onAnadir(clave)}
              onDuplicar={(trabajo) => onDuplicar(clave, trabajo)}
              onBorrar={(trabajo) => onBorrar(clave, trabajo)}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {arrastrando && (
          <div className="relative w-[160px] overflow-hidden rounded-xl border border-white/25 bg-[#141A21] p-2 pl-2.5 shadow-2xl">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
              style={{ background: franjaDeLados(ladosDe(arrastrando)) }}
            />

            {/* El fantasma va corto aunque la rejilla esté en detalle: lo que
                importa mientras se arrastra es dónde va a caer. */}
            <TrabajoCuerpo trabajo={arrastrando} detalle={false} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
