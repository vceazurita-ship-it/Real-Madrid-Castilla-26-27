"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { ChevronDown, ClipboardList, Plus, SearchX, Target, Trash2 } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useSaveGuard } from "@/hooks/useSaveGuard";
import { useAutoSave } from "@/hooks/useAutoSave";
import {
  AutoTextarea,
  ConfirmDialog,
  EditToolbar,
  EmptyState,
  ErrorState,
  Highlight,
  LoadingState,
  Modal,
  SearchField,
  SectionLabel,
  Spinner,
  focusRing,
  matches,
  useEditShortcuts,
} from "@/components/ui/knowledge-kit";
import { traeJson } from "@/lib/hojaCsv";
import { olvidaLoGuardado } from "@/lib/hojaRivales";
import {
  AVISO_TEXTO_LARGO,
  guardaTextoEnLaHoja,
} from "@/lib/guardaTextoHoja";
import { AvisoLargo } from "@/components/conocimiento/AvisoLargo";
import { sePuedeDescartar } from "@/components/abp/ui";
import { cn } from "@/lib/utils";
import { usePlayers } from "@/hooks/usePlayers";
import { nombrePuesto } from "@/lib/posiciones";
import type { Player } from "@/types/player";
import { confirmar } from "@/lib/avisos";
import {
  MINUTOS_CONTENIDO,
  cifraDelContenido,
  medidaDelContenido,
  nombreColumna,
  quienLoEjecutaMejor,
  type CifraDelContenido,
} from "@/lib/identidad/campo";
import { QuienLoEjecutaVista } from "@/components/identidad/QuienLoEjecuta";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { mismaPersona, nombreCanonico } from "@/lib/data-analisis/nombres";

/*
| 08/11/2026: los jugadores de Wyscout (los de la categoría) para poner la
| cifra del grupo bajo cada contenido medido. Una sola petición para la
| pantalla; si falla, el contenido dice sólo con qué se mide.
*/
let promesaJugadores: Promise<FilaJugador[]> | null = null;

function useJugadoresWyscout() {
  const [lista, setLista] = useState<FilaJugador[] | null>(null);

  useEffect(() => {
    let vivo = true;

    (promesaJugadores ??= traeJson<{ ok: boolean; jugadores?: FilaJugador[] }>(
      "/api/data-analisis",
    ).then((r) => r.jugadores ?? [])).then(
      (j) => vivo && setLista(j),
      () => {
        promesaJugadores = null;
      },
    );

    return () => {
      vivo = false;
    };
  }, []);

  return lista;
}

const PLURAL_PUESTO: Record<string, string> = {
  CEN: "Centrales",
  LAT: "Laterales",
  MED: "Centrocampistas",
  BAN: "Extremos",
  DEL: "Delanteros",
};

/* 17/11/2026 (guionista): un decimal como mucho, también en las cifras por 90′. */
const cifraTexto = (v: number, porcentaje: boolean) =>
  porcentaje ? `${v.toFixed(1).replace(".", ",")} %` : v.toFixed(1).replace(".", ",");

/** Un jugador de la plantilla en el puesto: nombre corto (chip) y completo. */
type Quien = { corto: string; nombre: string };

/*
| 10/11/2026: +1 del lado bueno de la mediana, −1 del malo y 0 si, con los
| decimales que se enseñan, es la misma cifra (66,7 % contra 66,7 % no es ▲).
*/
const comparaConMediana = (
  v: number,
  c: { mediana: number; porcentaje: boolean; mejorAlto: boolean },
) => {
  if (cifraTexto(v, c.porcentaje) === cifraTexto(c.mediana, c.porcentaje)) return 0;

  return (v > c.mediana) === c.mejorAlto ? 1 : -1;
};

/** El nombre de Wyscout («Oscar Naasei») con el de la plantilla («Óscar»). */
const nombrePlantilla = (wyscout: string, quienes: Quien[]) =>
  quienes.find((q) => mismaPersona(wyscout, q.nombre) || mismaPersona(wyscout, q.corto))?.corto ??
  nombreCanonico(wyscout);

/*
| 16/11/2026: un porcentaje que sale de menos de 15 intentos es tendencia, no
| dato: se enseña sin ▲/▼ y no entra en «Por dónde empezar a entrenar».
*/
const MINIMO_INTENTOS = 15;

type JugadorCifra = CifraDelContenido["nuestros"][number];

/* 17/11/2026 (fútbol): también las cifras por 90′ con menos de 15 acciones
   (Joan, ≈2 conducciones en 602′, ya no sale ▼ ni con tarea). */
const esTendencia = (j: JugadorCifra) =>
  (j.intentos !== undefined && j.intentos < MINIMO_INTENTOS) ||
  (j.intentos === undefined && j.acciones !== undefined && j.acciones < MINIMO_INTENTOS);

/** «11 de 29» en los %, «≈ 26 en 883′» en las cifras por 90′. */
const baseDe = (j: JugadorCifra) =>
  j.intentos !== undefined && j.logrados !== undefined
    ? `${j.logrados} de ${j.intentos}`
    : j.acciones !== undefined
      ? `≈ ${j.acciones} en ${j.minutos.toLocaleString("es-ES")}′`
      : "";

/** Qué se cuenta en la tarea para cada medida (el «Qué entrenamos»). */
const QUE_CONTAR: Record<string, string> = {
  "Pases progresivos/90": "pases progresivos",
  "Carreras en progresión/90": "conducciones que ganan metros",
  "Precisión pases, %": "pases acertados de los intentados",
  "Duelos aéreos ganados, %": "duelos aéreos ganados de los disputados",
  "Interceptaciones/90": "balones interceptados",
  "Duelos defensivos ganados, %": "duelos defensivos ganados de los disputados",
  "Centros/90": "centros al área",
  "Ataque en profundidad/90": "ataques a la espalda de la línea",
  "Duelos atacantes ganados, %": "duelos con balón ganados de los disputados",
  "Regates realizados, %": "regates logrados de los intentados",
  "Toques en el área de penalti/90": "toques dentro del área",
  "xG/90": "ocasiones claras generadas",
  "Acciones defensivas realizadas/90": "acciones defensivas (presión, robo, duelo)",
};

/** 17/11/2026 (marketing): una línea que explica la medida la primera vez que sale. */
const EXPLICA: Record<string, string> = {
  "Pases progresivos/90": "pase hacia delante que acerca mucho el balón a la portería rival",
  "Carreras en progresión/90": "conducción que gana muchos metros hacia la portería rival",
  "Ataque en profundidad/90": "desmarque a la espalda de la última línea",
  "Acciones defensivas realizadas/90": "presiones, robos y duelos defensivos juntos",
};

/** «Óscar», «Óscar y Joan», «Óscar, Mario y Joan». */
const yLista = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;

type PosicionItem = {
  ID: number;
  POSICION: string;
  BLOQUE: string;
  TITULO: string;
  CONTENIDO: string;
  ORDEN: number;
  ACTIVO?: string;
  /*
  | 30/10/2026: columnas opcionales de la hoja. Si alguien las añade, cada
  | contenido se despliega con su definición, qué se ve, el criterio y un
  | clip; ROL es la idea del puesto («Iniciar el juego y defender el
  | espacio»). El texto lo escribe el cuerpo técnico: aquí no se inventa.
  */
  DESCRIPCION?: string;
  QUE_SE_VE?: string;
  CRITERIO?: string;
  VIDEO?: string;
  ROL?: string;
};

const limpio = (t?: unknown) => String(t ?? "").trim();

/** Lo que se despliega bajo un contenido; sólo lo que tiene texto. */
const detalle = (item: PosicionItem) => ({
  definicion: limpio(item.DESCRIPCION),
  queSeVe: limpio(item.QUE_SE_VE),
  criterio: limpio(item.CRITERIO),
  video: /^https?:\/\//i.test(limpio(item.VIDEO)) ? limpio(item.VIDEO) : "",
});

/*
| Qué puestos de la plantilla caen en cada posición de la hoja (30/10/2026).
| La plantilla llega ya corregida por `lib/posiciones.ts` (vía
| `usePlayers`) y en palabras con `nombrePuesto`; aquí sólo se decide qué
| familia es cada posición de la hoja («CENTRALES», «LATERALES»…).
*/
const FAMILIAS: [RegExp, RegExp][] = [
  [/^portero/, /^portero/],
  [/^central/, /^central/],
  [/^lateral|^carrilero/, /^lateral|^carrilero/],
  [/^extremo/, /^extremo/],
  [/^delanter|^punta/, /^delantero/],
  [/^mediapunta/, /^mediapunta/],
  [/^medio|^pivote|^interior|^centrocampista/, /^pivote|^interior|^mediocentro|^mediapunta/],
];

const sinTildes = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

function jugadoresDelPuesto(posicionHoja: string, plantilla: Player[]) {
  const familia = FAMILIAS.find(([hoja]) => hoja.test(sinTildes(posicionHoja)));

  if (!familia) return [];

  return plantilla
    .filter((j) => j.esCastilla)
    .filter((j) => familia[1].test(sinTildes(nombrePuesto(j.posicion))))
    .map((j) => ({ corto: j.apodo || j.nombre, nombre: j.nombre || j.apodo || "" }));
}

/*
| El icono de cada puesto (30/10/2026): un campo en miniatura con el sitio
| marcado. Dice dónde juega sin depender sólo del nombre.
*/
const SITIOS: [RegExp, [number, number][]][] = [
  [/^portero/, [[12, 27]]],
  [/^central/, [[9, 22], [15, 22]]],
  [/^lateral|^carrilero/, [[4, 20], [20, 20]]],
  [/^mediapunta/, [[12, 11]]],
  [/^extremo/, [[4, 9], [20, 9]]],
  [/^delanter|^punta/, [[12, 5]]],
  [/^medio|^pivote|^interior|^centrocampista/, [[8, 15], [16, 15]]],
];

function IconoPuesto({ posicion, activo }: { posicion: string; activo: boolean }) {
  const sitios = SITIOS.find(([re]) => re.test(sinTildes(posicion)))?.[1] ?? [];
  const trazo = activo ? "rgba(0,0,0,0.55)" : "rgba(200,169,107,0.55)";

  return (
    <svg viewBox="0 0 24 32" className="h-6 w-[18px] shrink-0" aria-hidden>
      <rect x="1" y="1" width="22" height="30" rx="2" fill="none" stroke={trazo} strokeWidth="1.2" />
      <line x1="1" y1="16" x2="23" y2="16" stroke={trazo} strokeWidth="1" />
      <rect x="7" y="25" width="10" height="6" fill="none" stroke={trazo} strokeWidth="1" />
      {sitios.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.4" fill={activo ? "#000" : "#C8A96B"} />
      ))}
    </svg>
  );
}

/**
 * Lo que llega de la hoja, sin comerse lo que se está escribiendo.
 *
 * Una relectura en plena edición (la de después de crear un contenido, que va
 * con `fresco=1` y puede tardar lo suyo) hacía `setData`/`setOriginalData`
 * con lo de la hoja y borraba lo tecleado mientras tanto. Aquí:
 *
 * - una fila tocada (su texto difiere de la base) conserva el texto local, y
 *   su base sigue siendo la de antes, así que el autoguardado la sigue viendo
 *   pendiente y la escribe;
 * - las no tocadas se ponen al día con la hoja;
 * - las filas nuevas de la hoja entran;
 * - una fila tocada que ya no está en la hoja se queda: si no se puede
 *   escribir, el aviso de guardado deja rescatar el texto.
 */
function mezclaConLoEditado(
  servidor: PosicionItem[],
  local: PosicionItem[],
  base: PosicionItem[],
): { data: PosicionItem[]; original: PosicionItem[] } {
  const baseDe = new Map(base.map((fila) => [fila.ID, fila]));
  const localDe = new Map(local.map((fila) => [fila.ID, fila]));

  const tocada = (fila: PosicionItem) => {
    const suBase = baseDe.get(fila.ID);

    return Boolean(suBase) && suBase!.CONTENIDO !== fila.CONTENIDO;
  };

  const enServidor = new Set(servidor.map((fila) => fila.ID));

  const data: PosicionItem[] = [];
  const original: PosicionItem[] = [];

  servidor.forEach((fila) => {
    const suya = localDe.get(fila.ID);

    if (suya && tocada(suya)) {
      data.push({ ...fila, CONTENIDO: suya.CONTENIDO });
      original.push(structuredClone(baseDe.get(fila.ID)!));
    } else {
      data.push(fila);
      original.push(structuredClone(fila));
    }
  });

  local.forEach((fila) => {
    if (enServidor.has(fila.ID) || !tocada(fila)) return;

    data.push(fila);
    original.push(structuredClone(baseDe.get(fila.ID)!));
  });

  return { data, original };
}

/** Columnas fijas: se muestran siempre, aunque la posición todavía no tenga contenidos. */
const BLOQUES_BASE = ["CON BALÓN", "SIN BALÓN"];

export default function IdentidadPosicionalPage() {
  const [data, setData] = useState<PosicionItem[]>([]);
  const [originalData, setOriginalData] = useState<PosicionItem[]>([]);

  const [posicion, setPosicion] = useState("");
  /* 13/11/2026: los contenidos del puesto o «¿Quién lo ejecuta mejor?». */
  const [vista, setVista] = useState<"contenidos" | "quien">("contenidos");
  const [query, setQuery] = useState("");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  const [porBorrar, setPorBorrar] = useState<PosicionItem | null>(null);
  const [borrando, setBorrando] = useState(false);

  /* Deja rescatar el texto de los contenidos que el servidor no acepte. */
  const { reportarRechazo, dialogo: avisoGuardado } = useSaveGuard();

  /*
  | Foto del contenido al entrar en edición. No es lo mismo que
  | `originalData`, que el autoguardado va adelantando conforme escribe: esta
  | se queda quieta y es a la que vuelve «Deshacer». (Declarada aquí arriba
  | porque la carga también la toca: ver `mezclaConLoEditado`.)
  */
  const [alEntrar, setAlEntrar] = useState<PosicionItem[]>([]);

  /* Lo que la carga necesita saber del momento en que llega, no del momento
     en que salió: si se está editando y qué hay escrito. Se ponen al día
     tras cada render, nunca durante. */
  const editandoRef = useRef(false);
  const dataRef = useRef<PosicionItem[]>([]);
  const originalRef = useRef<PosicionItem[]>([]);

  useEffect(() => {
    editandoRef.current = editing;
    dataRef.current = data;
    originalRef.current = originalData;
  });

  const [nuevoBloque, setNuevoBloque] = useState<string | null>(null);
  const [nuevoContenido, setNuevoContenido] = useState("");
  const [nuevoOrden, setNuevoOrden] = useState("");
  const [creando, setCreando] = useState(false);

  /* ------------------------------------------------------------ carga */

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        /*
        | La lectura va por `/api/rivals`, que guarda la respuesta del Apps
        | Script en el servidor: en frío ese script tarda entre treinta y
        | setenta segundos y esta pantalla se los comía enteros, una vez por
        | visita. Así sólo lo paga el primero del día.
        |
        | **Cualquier relectura pide `fresco=1`**, que se salta esa copia:
        | aquí sólo se vuelve a leer después de crear un contenido o de salir
        | de edición, y una copia de hace dos minutos diría que no está
        | escrito algo que sí lo está.
        */
        const fresco = recarga > 0;

        const rows = await traeJson<PosicionItem[]>(
          `/api/rivals?action=getIdentidadPosicional${fresco ? "&fresco=1" : ""}`,
          { forzar: fresco },
        );

        if (!Array.isArray(rows)) throw new Error("Respuesta inesperada");

        const activos = rows.filter(
          (r) => String(r.ACTIVO).toUpperCase() !== "FALSE",
        );

        if (cancelado) return;

        if (editandoRef.current) {
          const mezcla = mezclaConLoEditado(
            activos,
            dataRef.current,
            originalRef.current,
          );

          setData(mezcla.data);
          setOriginalData(mezcla.original);

          /* Lo recién creado entra también en la foto de «Deshacer»: si no,
             deshacer lo quitaba de la pantalla aunque siga en la hoja. */
          setAlEntrar((foto) => {
            const ya = new Set(foto.map((fila) => fila.ID));
            const nuevas = activos.filter((fila) => !ya.has(fila.ID));

            return nuevas.length > 0
              ? [...foto, ...structuredClone(nuevas)]
              : foto;
          });
        } else {
          setData(activos);
          setOriginalData(structuredClone(activos));
        }
        /* 17/11/2026 (marketing): ?puesto=central|lateral|medio|extremo|delantero
           abre en ese puesto y ?vista=quien en «¿Quién lo ejecuta mejor?»
           (los enlaces de Identidad de Juego). */
        const pide = new URLSearchParams(window.location.search);
        const familia = FAMILIAS.find(([hoja]) => hoja.test(sinTildes(pide.get("puesto") ?? "")));
        const pedido = familia ? activos.find((fila) => familia[0].test(sinTildes(fila.POSICION ?? "")))?.POSICION : undefined;

        setPosicion((actual) => actual || pedido || activos[0]?.POSICION || "");
        if (pide.get("vista") === "quien") setVista("quien");
        setError(null);
      } catch (err) {
        if (cancelado) return;

        setError(
          err instanceof Error
            ? err.message
            : "Error desconocido al cargar la identidad posicional.",
        );
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [recarga]);

  /** `conEsqueleto` distingue el reintento manual del refresco tras guardar o crear. */
  const recargar = useCallback((conEsqueleto = true) => {
    if (conEsqueleto) setLoading(true);
    setError(null);
    setRecarga((n) => n + 1);
  }, []);

  /* ------------------------------------------------------------ derivados */

  const posiciones = useMemo(
    () => [...new Set(data.map((r) => r.POSICION).filter(Boolean))],
    [data],
  );

  /** Los bloques base siempre presentes + cualquier otro que aparezca en la hoja. */
  const bloques = useMemo(() => {
    const extra = [...new Set(data.map((r) => r.BLOQUE).filter(Boolean))].filter(
      (b) => !BLOQUES_BASE.includes(b),
    );

    return [...BLOQUES_BASE, ...extra];
  }, [data]);

  /** Los filtros de texto se desactivan al editar para no ocultar lo que se escribe. */
  const visibles = useMemo(
    () => (editing ? data : data.filter((r) => matches(query, r.CONTENIDO))),
    [data, editing, query],
  );

  const contenidos = useMemo(
    () =>
      visibles
        .filter((r) => r.POSICION === posicion)
        .sort((a, b) => Number(a.ORDEN) - Number(b.ORDEN)),
    [visibles, posicion],
  );

  const totalPosicion = useMemo(
    () => data.filter((r) => r.POSICION === posicion).length,
    [data, posicion],
  );

  const filtrando = !editing && query.trim() !== "";

  /*
  | 30/10/2026: el subtítulo ya no repite los contadores («9 con balón y 11
  | sin balón», que salen en la cabecera de cada columna). Lleva la idea del
  | puesto si la hoja la trae en ROL; si no, no sale nada.
  */
  const rolPosicion = useMemo(
    () =>
      data
        .filter((r) => r.POSICION === posicion)
        .map((r) => limpio(r.ROL))
        .find(Boolean) ?? "",
    [data, posicion],
  );

  /* Quién de la plantilla ocupa el puesto. Sin nadie, la línea no sale. */
  const { players } = usePlayers();

  const quienes = useMemo(
    () => (posicion ? jugadoresDelPuesto(posicion, players) : []),
    [posicion, players],
  );

  /*
  | 10/11/2026: las cifras del puesto, para tres cosas de la cabecera: los
  | minutos de liga de quien no llega a 450′ (sale en los chips pero no en
  | ninguna cifra, y se dice por qué), el contenido en que más jugadores
  | quedan por debajo de la mediana (por dónde empieza el entrenamiento) y el
  | puesto de Identidad en el Campo, con un solo enlace.
  */
  const jugadoresWyscout = useJugadoresWyscout();

  const cifrasPuesto = useMemo(() => {
    if (!jugadoresWyscout) return [];

    return data
      .filter((r) => r.POSICION === posicion)
      .flatMap((r) => {
        const c = cifraDelContenido(jugadoresWyscout, r.POSICION ?? "", r.CONTENIDO ?? "");

        return c ? [{ item: r, cifra: c }] : [];
      });
  }, [jugadoresWyscout, data, posicion]);

  const prioridad = useMemo(() => {
    const conDebajo = cifrasPuesto
      .map((x) => ({
        ...x,
        firmes: x.cifra.nuestros.filter((j) => !esTendencia(j)).length,
        debajo: x.cifra.nuestros.filter((j) => !esTendencia(j) && comparaConMediana(j.valor, x.cifra) < 0),
      }))
      .filter((x) => x.debajo.length > 0)
      .sort(
        (a, b) =>
          b.debajo.length / b.firmes - a.debajo.length / a.firmes ||
          b.debajo.length - a.debajo.length,
      );

    return conDebajo[0] ?? null;
  }, [cifrasPuesto]);

  const puestoCampo = cifrasPuesto[0]?.cifra.puesto ?? null;

  /* 17/11/2026 (fútbol y marketing): quién del puesto sale en alguna cifra; al
     que no llega a los minutos se le dice en su chip, para que no parezca un hueco. */
  const conCifra = useMemo(
    () => new Set(cifrasPuesto.flatMap((x) => x.cifra.nuestros.map((j) => nombrePlantilla(j.nombre, quienes)))),
    [cifrasPuesto, quienes],
  );

  /*
  | 13/11/2026: «¿Quién lo ejecuta mejor?»: toda la plantilla de campo contra
  | los contenidos medidos del puesto. Los nombres, con los de la plantilla
  | entera (no sólo los del puesto), para los que vienen de otra demarcación.
  */
  const quienLoEjecuta = useMemo(
    () =>
      jugadoresWyscout && posicion
        ? quienLoEjecutaMejor(
            jugadoresWyscout,
            posicion,
            data.filter((r) => r.POSICION === posicion).sort((a, b) => Number(a.ORDEN) - Number(b.ORDEN)).map((r) => r.CONTENIDO ?? ""),
          )
        : null,
    [jugadoresWyscout, data, posicion],
  );

  const plantillaEntera = useMemo<Quien[]>(
    () =>
      players
        .filter((j) => j.esCastilla)
        .map((j) => ({ corto: j.apodo || j.nombre, nombre: j.nombre || j.apodo || "" })),
    [players],
  );

  const nombreDe = useCallback(
    (wyscout: string): Quien =>
      plantillaEntera.find((q) => mismaPersona(wyscout, q.nombre) || mismaPersona(wyscout, q.corto)) ?? {
        corto: nombreCanonico(wyscout),
        nombre: nombreCanonico(wyscout),
      },
    [plantillaEntera],
  );

  const enQuien = vista === "quien" && !editing;

  const cambios = useMemo(
    () =>
      data.filter((item) => {
        const original = originalData.find((o) => o.ID === item.ID);
        return original && original.CONTENIDO !== item.CONTENIDO;
      }),
    [data, originalData],
  );

  /* ------------------------------------------------------------ edición */

  const entrarEnEdicion = () => {
    setAlEntrar(structuredClone(data));

    setQuery("");
    setEditing(true);
  };

  const tocados = useMemo(
    () =>
      editing
        ? data.filter((item) => {
            const inicial = alEntrar.find((o) => o.ID === item.ID);
            return inicial && inicial.CONTENIDO !== item.CONTENIDO;
          }).length
        : 0,
    [data, editing, alEntrar],
  );

  /*
  |--------------------------------------------------------------------------
  | AUTOGUARDADO
  |--------------------------------------------------------------------------
  |
  | En edición no hay botón de guardar: cada contenido sale hacia la hoja unos
  | segundos después de dejar de escribirlo. Sólo viajan los que han cambiado
  | respecto a la última versión confirmada, así que escribir en un bloque no
  | reenvía los otros veinte.
  */

  /* La base contra la que se calcula el diff, siempre fresca dentro del
     temporizador del autoguardado. */
  const baseRef = useRef(originalData);

  useEffect(() => {
    baseRef.current = originalData;
  });

  /* Si el último guardado llegó a la hoja. Lo lee `terminarEdicion` tras el
     `flush`: el estado del hook todavía no se ha repintado en ese momento. */
  const ultimoGuardadoOk = useRef(true);

  /* Huella del último fallo que ya se enseñó; se borra con un guardado bueno. */
  const rechazoAvisado = useRef<string | null>(null);

  const escribirCambios = useCallback(
    async (actual: PosicionItem[]) => {
      const pendientes = actual.filter((item) => {
        const original = baseRef.current.find((o) => o.ID === item.ID);

        return original && original.CONTENIDO !== item.CONTENIDO;
      });

      if (pendientes.length === 0) return true;

      /* Un texto largo no cabe en la dirección del GET: ver
         `lib/guardaTextoHoja.ts` (19/10/2026). */
      const resultados = await Promise.allSettled(
        pendientes.map((p) =>
          guardaTextoEnLaHoja("guardarIdentidadPosicional", {
            ID: p.ID,
            CONTENIDO: p.CONTENIDO,
          }),
        ),
      );

      /* Una respuesta de error también es un cambio perdido: contarla como
         éxito porque la petición se completó es lo que hace que el texto
         desaparezca sin avisar. */
      const fallidos = pendientes.filter((_, indice) => {
        const resultado = resultados[indice];

        return resultado.status === "rejected" || !resultado.value.ok;
      });

      const porLargo = resultados.some(
        (r) => r.status === "fulfilled" && !r.value.ok && r.value.largo,
      );

      if (fallidos.length > 0) {
        const campos = Object.fromEntries(
          fallidos.map((p) => [
            `${p.POSICION} · ${p.BLOQUE} · ${p.TITULO || p.ID}`,
            p.CONTENIDO,
          ]),
        );

        /* El autoguardado reintenta solo: el aviso sale una vez por fallo
           distinto, no en cada reintento ni en cada tecla (07/10/2026). Se
           mira qué contenidos fallan, no lo que dicen. */
        const huella = JSON.stringify(Object.keys(campos).sort());

        if (rechazoAvisado.current !== huella) {
          rechazoAvisado.current = huella;

          reportarRechazo({
            titulo: "Identidad posicional · cambios sin guardar",
            campos,
          });

          if (porLargo) {
            toast.error(AVISO_TEXTO_LARGO.titulo, {
              description: AVISO_TEXTO_LARGO.descripcion,
              duration: 12000,
            });
          }
        }

        ultimoGuardadoOk.current = false;

        return false;
      }

      ultimoGuardadoOk.current = true;
      rechazoAvisado.current = null;

      /* Estos guardados van por `GET` directos al script, así que la caché
         del servidor no se entera sola: si no, otro vería lo de antes hasta
         diez minutos. */
      olvidaLoGuardado();

      /* Lo escrito pasa a ser la nueva base. No se recarga de la hoja: eso
         machacaría lo que el usuario esté tecleando en este momento. */
      setOriginalData(structuredClone(actual));

      return true;
    },
    [reportarRechazo],
  );

  const auto = useAutoSave<PosicionItem[]>({
    value: data,
    enabled: editing,
    debounce: 1500,
    save: escribirCambios,
  });

  const salirDeEdicion = useCallback(async () => {
    if (tocados === 0) {
      setEditing(false);
      return;
    }

    if (
      !(await confirmar(
        "¿Deshacer todo lo escrito desde que entraste en edición? Ya está guardado, así que esto lo revierte en la hoja.",
      ))
    ) {
      return;
    }

    setData(structuredClone(alEntrar));

    toast.info("Cambios deshechos");
  }, [tocados, alEntrar]);

  const terminarEdicion = useCallback(async () => {
    setSaving(true);

    /* Si no hay nada pendiente, `flush` no llega a guardar y esto se queda
       en `true`, que es lo que es. */
    ultimoGuardadoOk.current = true;

    try {
      await auto.flush();
    } catch {
      ultimoGuardadoOk.current = false;
    } finally {
      setSaving(false);
    }

    /*
    | Si no ha llegado a la hoja, se sigue en edición (07/10/2026). Salir era
    | releer la hoja y pintar encima lo que había antes: lo escrito
    | desaparecía de la pantalla con el aviso de error todavía puesto. Así se
    | queda a la vista y el autoguardado lo sigue reintentando.
    */
    if (!ultimoGuardadoOk.current) {
      toast.error("No se han podido guardar todos los cambios", {
        description:
          "Se sigue en edición hasta que lleguen a la hoja: se reintenta solo.",
      });

      return;
    }

    setEditing(false);

    /* Ya fuera de edición se relee: nadie está escribiendo y así entra lo que
       hayan tocado otros. */
    recargar(false);
  }, [auto, recargar]);

  useEditShortcuts({
    editing,
    onSave: terminarEdicion,
    onCancel: salirDeEdicion,
  });

  /* ------------------------------------------------------------ borrar */

  const confirmarBorrado = async () => {
    if (!porBorrar) return;

    setBorrando(true);

    try {
      const { ok } = await guardaTextoEnLaHoja("borrarIdentidadPosicional", {
        ID: porBorrar.ID,
      });

      if (!ok) throw new Error("La hoja no lo ha borrado");

      olvidaLoGuardado();

      setData((prev) => prev.filter((x) => x.ID !== porBorrar.ID));
      setOriginalData((prev) => prev.filter((x) => x.ID !== porBorrar.ID));

      /* Y de la foto de «Deshacer»: si no, deshacer lo resucitaba en
         pantalla aunque en la hoja ya no esté. */
      setAlEntrar((prev) => prev.filter((x) => x.ID !== porBorrar.ID));

      toast.success("Contenido eliminado");
      setPorBorrar(null);
    } catch (err) {
      console.error(err);
      toast.error("No se ha podido eliminar el contenido");
    } finally {
      setBorrando(false);
    }
  };

  /* ------------------------------------------------------------ crear */

  /** Siguiente ORDEN libre dentro de la posición y el bloque indicados. */
  const siguienteOrden = useCallback(
    (bloque: string) =>
      data
        .filter((r) => r.POSICION === posicion && r.BLOQUE === bloque)
        .reduce((max, r) => Math.max(max, Number(r.ORDEN) || 0), 0) + 1,
    [data, posicion],
  );

  const abrirNuevo = (bloque: string) => {
    /* Crear recarga la lista desde la hoja, así que lo que aún no se haya
       escrito se perdería: primero se consolida lo pendiente. */
    if (cambios.length > 0) {
      void auto.flush();
    }

    setNuevoBloque(bloque);
    setNuevoContenido("");
    setNuevoOrden(String(siguienteOrden(bloque)));
  };

  /*
  | Cerrar la ventana de «Nuevo contenido» —con Cancelar, la X, Escape o
  | pinchando fuera— tiraba lo escrito sin preguntar (19/10/2026). Ahora se
  | pregunta si hay texto, como en el resto de ventanas de la app.
  */
  const cerrarNuevo = async () => {
    if (creando) return;

    if (!(await sePuedeDescartar(nuevoContenido.trim() !== ""))) return;

    setNuevoBloque(null);
  };

  const crearItem = async () => {
    if (!nuevoBloque) return;

    if (!nuevoContenido.trim()) {
      toast.error("Introduce un contenido");
      return;
    }

    setCreando(true);

    try {
      const { ok, largo } = await guardaTextoEnLaHoja(
        "crearIdentidadPosicional",
        {
          POSICION: posicion,
          BLOQUE: nuevoBloque,
          CONTENIDO: nuevoContenido.trim(),
          ORDEN: nuevoOrden,
        },
      );

      if (!ok) {
        if (largo) {
          toast.error(AVISO_TEXTO_LARGO.titulo, {
            description: AVISO_TEXTO_LARGO.descripcion,
            duration: 12000,
          });
        }

        throw new Error("La hoja no lo ha creado");
      }

      /* Lo nuevo entra en la foto de «Deshacer» con la relectura de abajo
         (ver la carga), que es cuando se sabe su ID. */
      toast.success("Contenido añadido");

      setNuevoBloque(null);
      setNuevoContenido("");
      setNuevoOrden("");

      recargar(false);
    } catch (err) {
      console.error(err);

      /* El texto sigue en el formulario, pero se ofrece exportarlo por si la
         siguiente acción del usuario es cerrar o recargar. */
      reportarRechazo({
        titulo: "Identidad posicional · contenido sin crear",
        campos: {
          [`${posicion} · ${nuevoBloque ?? ""}`]: nuevoContenido.trim(),
        },
      });
    } finally {
      setCreando(false);
    }
  };

  /* ------------------------------------------------------------ render */

  const toolbar = (
    <EditToolbar
      editing={editing}
      dirtyCount={tocados}
      saving={saving}
      onEdit={entrarEnEdicion}
      onCancel={salirDeEdicion}
      onSave={terminarEdicion}
      autoSave={{
        estado: auto.status,
        guardadoEn: auto.lastSavedAt,
        onReintentar: () => void auto.flush(),
      }}
    />
  );

  const renderBloque = (bloque: string) => {
    /* 10/11/2026: fuera de edición, lo que se mide va primero (el orden de la
       hoja se respeta dentro de cada grupo); en edición, el de la hoja. */
    const delBloque = contenidos.filter((c) => c.BLOQUE === bloque);
    const medido = (c: PosicionItem) => (medidaDelContenido(c.POSICION ?? "", c.CONTENIDO ?? "") ? 0 : 1);
    const items = editing ? delBloque : [...delBloque].sort((a, b) => medido(a) - medido(b));
    /* 16/11/2026: lo que no se mide se pliega tras «Ver los otros N» para que
       lo medido sea lo primero (salvo editando o buscando). */
    const plegar = !editing && !filtrando;
    /* 17/11/2026 (marketing): a la vista, como mucho 3 medidos por columna; el
       resto (medidos y sin medir) tras «Ver los otros N». */
    const todosMedidos = plegar ? items.filter((c) => medido(c) === 0) : items;
    const medidosB = plegar ? todosMedidos.slice(0, 3) : items;
    const plegados = plegar ? [...todosMedidos.slice(3), ...items.filter((c) => medido(c) === 1)] : [];
    const total = data.filter(
      (c) => c.POSICION === posicion && c.BLOQUE === bloque,
    ).length;

    return (
      <section key={bloque} className="min-w-0">
        {/* 30/10/2026: con balón y sin balón, cada uno con su color de
            cabecera (dorado / azul) y el contador en su chip. */}
        <div
          className={cn(
            "mb-5 flex items-center justify-between gap-3 border-b-2 pb-3",
            /SIN/i.test(bloque) ? "border-sky-400/50" : "border-[#C8A96B]/60",
          )}
        >
          <h2
            className={cn(
              "text-lg font-bold tracking-wide lg:text-xl",
              /SIN/i.test(bloque) ? "text-sky-300" : "text-[#C8A96B]",
            )}
          >
            {bloque}
          </h2>

          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
              /SIN/i.test(bloque) ? "bg-sky-400/15 text-sky-300" : "bg-[#C8A96B]/15 text-[#C8A96B]",
            )}
          >
            {filtrando ? `${items.length} de ${total}` : total}{" "}
            contenido{total === 1 ? "" : "s"}
          </span>
        </div>

        {items.length === 0 && !editing ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-gray-600">
            {filtrando
              ? "Ningún contenido coincide"
              : "Todavía sin contenidos"}
          </p>
        ) : (
          <ul className="space-y-4">
            {medidosB.map((item) => (
              <li
                key={item.ID}
                className={cn(
                  editing || medido(item) === 0 ? "border-b border-white/[0.07] pb-4 last:border-0" : "pb-1",
                )}
              >
                {editing ? (
                  <div className="space-y-2">
                    <AutoTextarea
                      value={item.CONTENIDO}
                      minRows={2}
                      aria-label={`Contenido ${item.ORDEN} de ${bloque}`}
                      onChange={(e) =>
                        setData((prev) =>
                          prev.map((x) =>
                            x.ID === item.ID
                              ? { ...x, CONTENIDO: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />

                    <AvisoLargo texto={item.CONTENIDO} />

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setPorBorrar(item)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-300",
                          focusRing,
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                        medido(item) === 0 ? "bg-[#C8A96B]" : "bg-gray-500/60",
                      )}
                    />

                    <FichaContenido item={item} query={query} quienes={quienes} esPrioridad={prioridad?.item.ID === item.ID} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {plegados.length > 0 && (
          <details className="group mt-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-gray-200 [&::-webkit-details-marker]:hidden">
              <span>
                {medidosB.length > 0 ? "Ver los otros" : "Ver los"} {plegados.length} contenido{plegados.length === 1 ? "" : "s"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[#C8A96B] transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="space-y-2 border-t border-white/10 px-4 py-3">
              {plegados.map((item) => (
                <li key={item.ID} className="flex gap-3">
                  <span
                    aria-hidden
                    className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", medido(item) === 0 ? "bg-[#C8A96B]" : "bg-gray-500/60")}
                  />
                  <FichaContenido item={item} query={query} quienes={quienes} esPrioridad={prioridad?.item.ID === item.ID} />
                </li>
              ))}
            </ul>
          </details>
        )}

        {editing && (
          <button
            type="button"
            onClick={() => abrirNuevo(bloque)}
            className={cn(
              "mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 px-4 py-3 text-sm text-gray-400 transition-colors hover:border-[#C8A96B]/50 hover:bg-[#C8A96B]/[0.06] hover:text-[#C8A96B]",
              focusRing,
            )}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Añadir en {bloque}
          </button>
        )}
      </section>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#0B0F14]">
      <Sidebar />

      <div className="flex-1 min-w-0">
        <Topbar />

        <div className="flex flex-col lg:flex-row">
          {/* ---------------------------------------------- rail izquierdo */}

          <aside
            aria-label="Posiciones"
            /* 30/10/2026: en el móvil, buscador y puestos fijos arriba al bajar. */
            className="w-full border-white/10 p-4 max-lg:sticky max-lg:top-0 max-lg:z-20 max-lg:border-b max-lg:bg-[var(--background)] max-lg:py-3 lg:w-[280px] lg:shrink-0 lg:border-r lg:p-6 xl:w-[320px]"
          >
            <SectionLabel className="text-[#C8A96B] max-lg:hidden">Posiciones</SectionLabel>

            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Buscar contenido…"
              label="Buscar en los contenidos individuales"
              className={cn("lg:mt-4", editing && "pointer-events-none opacity-40")}
            />

            {/* 30/10/2026: en el móvil la tira cortaba los puestos («ME…»)
                sin decir que seguía. Ahora es una rejilla de 2×3 con los seis
                a la vista; en escritorio, la lista de siempre. */}
            <nav className="mt-3 grid grid-cols-2 gap-2 lg:mt-5 lg:grid-cols-1">
              {posiciones.map((p) => {
                const total = visibles.filter((x) => x.POSICION === p).length;
                const activo = posicion === p;

                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPosicion(p)}
                    aria-current={activo ? "true" : undefined}
                    className={cn(
                      "flex min-w-0 flex-row items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-all lg:gap-3 lg:rounded-2xl lg:px-4 lg:py-3",
                      focusRing,
                      activo
                        ? "bg-[#C8A96B] text-black shadow-[0_8px_24px_-12px_rgba(200,169,107,0.9)]"
                        : "border border-white/10 text-gray-200 hover:border-[#C8A96B]/40 hover:bg-white/[0.04] hover:text-white",
                      filtrando && total === 0 && !activo && "opacity-40",
                    )}
                  >
                    {/* 07/11/2026: en el móvil, dos columnas sin icono y el nombre
                        entero («MEDIOCENTROS» se partía en tres columnas). */}
                    <span className="max-lg:hidden">
                      <IconoPuesto posicion={p} activo={activo} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-row items-center justify-between gap-2 lg:gap-3">
                      <span className="min-w-0 whitespace-nowrap text-xs font-semibold leading-tight sm:text-sm">
                        {p}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[11px] tabular-nums sm:text-xs",
                          activo ? "text-black/70" : "text-gray-400",
                        )}
                      >
                        {total}
                        <span className="max-lg:hidden"> contenido{total === 1 ? "" : "s"}</span>
                      </span>
                    </span>
                  </button>
                );
              })}

              {loading &&
                [0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 w-full animate-pulse rounded-2xl bg-white/[0.04]"
                  />
                ))}
            </nav>
          </aside>

          {/* ---------------------------------------------- contenido */}

          {/* 30/10/2026: pb-24 para que el botón flotante de herramientas no
              tape el final de la tarjeta. */}
          <main className={cn("min-w-0 flex-1 p-4 pb-24 lg:p-8 lg:pb-24", editing && "pb-32")}>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5 sm:p-8 lg:rounded-3xl lg:p-10">
              {/* 17/11/2026 (fútbol): en el móvil, Editar va en su propia línea
                  encima y la tarjeta de prioridad ocupa todo el ancho. */}
              <div className="flex flex-col-reverse items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <SectionLabel className="text-[#C8A96B]">
                    Contenidos individuales
                  </SectionLabel>

                  <h1 className="mt-3 break-words text-3xl font-bold text-white sm:text-4xl lg:text-6xl">
                    {posicion || "—"}
                  </h1>

                  {rolPosicion && !editing && (
                    <p className="mt-3 text-base text-gray-300">{rolPosicion}</p>
                  )}

                  {quienes.length > 0 && !editing && (
                    /* 30/10/2026: cada nombre lleva a su ficha individual; la
                       fuente es la plantilla del Castilla. */
                    /* 07/11/2026: chips visibles que abren su «Área de mejora»:
                       del contenido del puesto a su plan de trabajo. */
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-gray-400">Sus jugadores · su área de mejora:</span>
                      {/* 16/11/2026: sin la coletilla «menos de 450′: no entra
                          en las cifras» (el umbral se dice una vez en la
                          leyenda), y con su seguimiento a un toque. */}
                      {quienes.map((uno) => (
                        <span
                          key={uno.nombre}
                          className="inline-flex items-center overflow-hidden rounded-full border border-[#C8A96B]/40 text-sm font-semibold text-gray-200"
                        >
                          <Link
                            href={`/individual?nombre=${encodeURIComponent(uno.nombre ?? "")}&pestana=mejora`}
                            title={`Área de mejora de ${uno.corto}`}
                            className={cn("inline-flex items-center gap-1 px-3 py-1 transition-colors hover:bg-[#C8A96B]/10 hover:text-white", focusRing)}
                          >
                            {uno.corto}
                            {cifrasPuesto.length > 0 && !conCifra.has(uno.corto) && (
                              <span className="text-[12px] font-normal text-gray-400">· menos de {MINUTOS_CONTENIDO}′</span>
                            )}
                            <span aria-hidden className="text-[color:var(--rmcf-gold-ink,#C8A96B)]">→</span>
                          </Link>
                          <Link
                            href={`/individual?nombre=${encodeURIComponent(uno.nombre ?? "")}&pestana=seguimiento`}
                            title={`Seguimiento de ${uno.corto}`}
                            aria-label={`Seguimiento de ${uno.corto}`}
                            className={cn("zona-dedo inline-flex items-center gap-1 border-l border-[#C8A96B]/30 px-2 py-1 text-[12px] font-medium text-gray-300 transition-colors hover:bg-[#C8A96B]/10 hover:text-white", focusRing)}
                          >
                            {/* 20/11/2026 (jueces): el icono solo no decía adónde lleva; ahora con su palabra. */}
                            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                            Seguimiento
                          </Link>
                        </span>
                      ))}
                    </div>
                  )}

                  {cifrasPuesto.length > 0 && !editing && (
                    <div className="mt-4 space-y-3 text-sm">
                      {prioridad && (
                        /* 16/11/2026: tarjeta destacada con un titular, el
                           objetivo y su base; los de «tendencia» no cuentan. */
                        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.07] p-4">
                          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
                            <Target className="h-3.5 w-3.5" aria-hidden />
                            Por dónde empezar a entrenar
                          </p>
                          <p className="mt-1 break-words text-xl font-bold text-white lg:text-2xl">
                            {prioridad.item.CONTENIDO.replace(/\bvs\.?(?=\s)/gi, "contra").replace(/\.$/, "")}
                          </p>
                          {/* 17/11/2026 (guionista): partido en líneas que se leen en 3 segundos:
                              la frase, una fila por jugador y el objetivo. */}
                          <p className="mt-1 break-words text-sm text-gray-200">
                            {prioridad.debajo.length === prioridad.firmes && prioridad.firmes > 1
                              ? `Los ${prioridad.firmes} están por debajo de la mediana del puesto`
                              : `${yLista(prioridad.debajo.map((j) => nombrePlantilla(j.nombre, quienes)))}, por debajo de la mediana del puesto`}
                          </p>
                          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            {prioridad.debajo.map((j) => (
                              <li key={j.nombre} className="tabular-nums text-gray-300">
                                <Link
                                  href={`/individual?nombre=${encodeURIComponent(j.nombre)}&pestana=mejora`}
                                  className="font-semibold text-white hover:underline"
                                >
                                  {nombrePlantilla(j.nombre, quienes)}
                                </Link>{" "}
                                <span className="font-semibold text-amber-400">{cifraTexto(j.valor, prioridad.cifra.porcentaje)}</span>
                                {baseDe(j) ? <span className="text-gray-400"> ({baseDe(j)})</span> : null}
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 break-words text-sm text-gray-300">
                            Objetivo: {prioridad.cifra.mejorAlto ? "llegar a" : "bajar de"}{" "}
                            <b className="text-white">{cifraTexto(prioridad.cifra.mediana, prioridad.cifra.porcentaje)}</b>, la mediana de{" "}
                            {prioridad.cifra.n} {(PLURAL_PUESTO[prioridad.cifra.puesto] ?? "jugadores").toLowerCase()} con{" "}
                            {MINUTOS_CONTENIDO}′ o más.
                          </p>
                        </div>
                      )}
                      <RadiografiaPuesto cifras={cifrasPuesto} quienes={quienes} />
                      <p className="break-words text-xs text-gray-400">
                        Cifras de liga (Wyscout) de los que llevan {MINUTOS_CONTENIDO}′ o más: ▲ mejor que la
                        mediana del puesto en la categoría (raya azul) · ▼ peor · = la misma cifra · «tendencia»: menos
                        de {MINIMO_INTENTOS} acciones o intentos (punto hueco, sin tarea).{" "}
                        <Link
                          href={`/identidad-campo${puestoCampo ? `#puesto-${puestoCampo}` : ""}`}
                          className="font-semibold text-[color:var(--rmcf-gold-ink,#C8A96B)] hover:underline"
                        >
                          Ver el puesto en Identidad en el Campo →
                        </Link>
                      </p>
                    </div>
                  )}
                </div>

                {!editing && !loading && !error && <div className="flex justify-end sm:block">{toolbar}</div>}
              </div>

              {!editing && !loading && !error && totalPosicion > 0 && (
                /* 16/11/2026: en el móvil, una fila de dos mitades. */
                <div role="group" aria-label="Vista" className="mt-6 grid w-full grid-cols-2 gap-1 rounded-xl border border-white/10 p-1 sm:inline-grid sm:w-auto">
                  {(
                    [
                      ["contenidos", "Contenidos del puesto"],
                      ["quien", "¿Quién lo ejecuta mejor?"],
                    ] as const
                  ).map(([v, texto]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVista(v)}
                      aria-pressed={vista === v}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-center text-xs font-semibold transition-colors sm:text-sm",
                        focusRing,
                        vista === v ? "bg-[#C8A96B] text-black" : "text-gray-300 hover:bg-white/[0.06] hover:text-white",
                      )}
                    >
                      {texto}
                    </button>
                  ))}
                </div>
              )}

              <div className={enQuien ? "mt-6" : "mt-10"}>
                {loading ? (
                  <LoadingState rows={3} />
                ) : error ? (
                  <ErrorState message={error} onRetry={() => recargar()} />
                ) : enQuien && totalPosicion > 0 ? (
                  <QuienLoEjecutaVista datos={quienLoEjecuta} cargando={!jugadoresWyscout} nombreDe={nombreDe} />
                ) : totalPosicion === 0 && !editing ? (
                  <EmptyState
                    title="Esta posición aún no tiene contenidos"
                    hint="Entra en modo edición para añadir el primero."
                  />
                ) : filtrando && contenidos.length === 0 ? (
                  <EmptyState
                    icon={<SearchX className="h-6 w-6" aria-hidden />}
                    title="Sin resultados en esta posición"
                    hint={`«${posicion}» tiene ${totalPosicion} contenidos, pero ninguno contiene «${query.trim()}». Los contadores del rail izquierdo indican dónde sí hay coincidencias.`}
                    action={
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        className={cn(
                          "rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/10",
                          focusRing,
                        )}
                      >
                        Limpiar búsqueda
                      </button>
                    }
                  />
                ) : (
                  <div className="grid gap-10 lg:grid-cols-2">
                    {bloques.map(renderBloque)}
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Barra de guardado siempre accesible durante la edición */}
      {editing && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0B0F14]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-end">
            {toolbar}
          </div>
        </div>
      )}

      {/* Nuevo contenido */}
      <Modal
        open={nuevoBloque !== null}
        onClose={cerrarNuevo}
        title="Nuevo contenido"
        description={`Se añadirá a ${posicion} · ${nuevoBloque ?? ""}`}
        footer={
          <>
            <button
              type="button"
              onClick={cerrarNuevo}
              disabled={creando}
              className={cn(
                "rounded-xl border border-white/15 px-5 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50",
                focusRing,
              )}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={crearItem}
              disabled={creando || !nuevoContenido.trim()}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl bg-[#C8A96B] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#d8bd85] disabled:cursor-not-allowed disabled:opacity-40",
                focusRing,
              )}
            >
              {creando && <Spinner />}
              {creando ? "Creando…" : "Crear"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label
              htmlFor="nuevo-bloque"
              className="mb-2 block text-sm text-gray-400"
            >
              Bloque
            </label>

            <select
              id="nuevo-bloque"
              value={nuevoBloque ?? ""}
              onChange={(e) => {
                setNuevoBloque(e.target.value);
                setNuevoOrden(String(siguienteOrden(e.target.value)));
              }}
              className={cn(
                "w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white",
                focusRing,
              )}
            >
              {bloques.map((b) => (
                <option key={b} value={b} className="bg-[#11161D]">
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="nuevo-contenido"
              className="mb-2 block text-sm text-gray-400"
            >
              Contenido
            </label>

            <AutoTextarea
              id="nuevo-contenido"
              value={nuevoContenido}
              onChange={(e) => setNuevoContenido(e.target.value)}
              placeholder="Describe el foco individual…"
            />

            <AvisoLargo texto={nuevoContenido.trim()} />
          </div>

          <div>
            <label
              htmlFor="nuevo-orden"
              className="mb-2 block text-sm text-gray-400"
            >
              Orden
            </label>

            <input
              id="nuevo-orden"
              type="number"
              min={1}
              value={nuevoOrden}
              onChange={(e) => setNuevoOrden(e.target.value)}
              className={cn(
                "w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white",
                focusRing,
              )}
            />

            <p className="mt-2 text-xs text-gray-600">
              Define la posición del contenido dentro del bloque.
            </p>
          </div>
        </div>
      </Modal>

      {/* Confirmación de borrado */}
      <ConfirmDialog
        open={porBorrar !== null}
        title="¿Eliminar este contenido?"
        message={
          porBorrar
            ? `«${porBorrar.CONTENIDO.slice(0, 120)}${
                porBorrar.CONTENIDO.length > 120 ? "…" : ""
              }» se eliminará de ${porBorrar.POSICION}. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        destructive
        busy={borrando}
        onConfirm={confirmarBorrado}
        onCancel={() => !borrando && setPorBorrar(null)}
      />

      {avisoGuardado}
    </div>
  );
}

/*
| 17/11/2026 (marketing): la radiografía del puesto como primera imagen. Una
| fila por contenido medido (con balón y sin balón, cada uno con su color) y
| una columna por jugador: ▲ por encima de la mediana del puesto, ▼ por
| debajo, = en ella, ○ tendencia. El título es la conclusión.
*/
function RadiografiaPuesto({
  cifras,
  quienes,
}: {
  cifras: { item: PosicionItem; cifra: NonNullable<ReturnType<typeof cifraDelContenido>> }[];
  quienes: Quien[];
}) {
  const filas = [...cifras].sort(
    (a, b) => Number(/SIN/i.test(a.item.BLOQUE ?? "")) - Number(/SIN/i.test(b.item.BLOQUE ?? "")),
  );
  const nombres = Array.from(
    new Set(filas.flatMap((f) => f.cifra.nuestros.map((j) => nombrePlantilla(j.nombre, quienes)))),
  );

  if (filas.length < 2 || nombres.length === 0) return null;

  const signoDe = (f: (typeof filas)[number], quien: string) => {
    const j = f.cifra.nuestros.find((x) => nombrePlantilla(x.nombre, quienes) === quien);

    if (!j) return null;
    if (esTendencia(j)) return "t" as const;

    return comparaConMediana(j.valor, f.cifra);
  };
  const cuenta = nombres.map((n) => ({
    n,
    debajo: filas.filter((f) => {
      const sg = signoDe(f, n);

      return typeof sg === "number" && sg < 0;
    }).length,
    medidos: filas.filter((f) => typeof signoDe(f, n) === "number").length,
  }));
  const peor = [...cuenta].filter((c) => c.medidos > 0).sort((a, b) => b.debajo / b.medidos - a.debajo / a.medidos)[0];
  const titulo =
    peor && peor.debajo > 0
      ? `${peor.n}, por debajo de la mediana en ${peor.debajo} de ${peor.medidos} contenidos medidos`
      : `Todos en la mediana o por encima en los ${filas.length} contenidos medidos`;

  return (
    <figure className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
      <figcaption>
        <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Radiografía del puesto</span>
        <span className="mt-1 block break-words text-sm font-semibold text-white lg:text-base">{titulo}</span>
      </figcaption>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-0 border-separate border-spacing-1 text-[13px]">
          <thead>
            <tr>
              <th scope="col" className="sr-only">Contenido</th>
              {nombres.map((n) => (
                <th key={n} scope="col" className="px-1 text-center text-[12px] font-semibold text-gray-300">
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const sin = /SIN/i.test(f.item.BLOQUE ?? "");

              return (
                <tr key={f.item.ID}>
                  <th
                    scope="row"
                    className={cn(
                      "border-l-2 pl-2 text-left text-[12px] font-medium leading-tight text-gray-200",
                      sin ? "border-sky-400/60" : "border-[#C8A96B]/70",
                    )}
                  >
                    {f.item.CONTENIDO.replace(/\bvs\.?(?=\s)/gi, "contra").replace(/\.$/, "")}
                  </th>
                  {nombres.map((n) => {
                    const sg = signoDe(f, n);

                    return (
                      <td
                        key={n}
                        className={cn(
                          "h-7 min-w-[2.25rem] rounded text-center font-bold tabular-nums",
                          sg === null
                            ? "text-gray-500"
                            : sg === "t"
                              ? "text-gray-400"
                              : sg < 0
                                ? "bg-amber-500/15 text-amber-400"
                                : sg > 0
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-white/[0.06] text-gray-200",
                        )}
                        aria-label={
                          sg === null ? `${n}: sin cifra` : sg === "t" ? `${n}: tendencia` : sg < 0 ? `${n}: por debajo` : sg > 0 ? `${n}: por encima` : `${n}: en la mediana`
                        }
                      >
                        {sg === null ? "" : sg === "t" ? "○" : sg < 0 ? "▼" : sg > 0 ? "▲" : "="}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-gray-400">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#C8A96B]" aria-hidden />con balón</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-sky-400" aria-hidden />sin balón</span>
        <span>▲ / ▼ frente a la mediana del puesto · ○ tendencia</span>
      </p>
    </figure>
  );
}

/*
|--------------------------------------------------------------------------
| UN CONTENIDO (30/10/2026)
|--------------------------------------------------------------------------
|
| Con definición, qué se ve, criterio o clip en la hoja, se despliega y
| enseña sólo eso. Sin nada, es una línea sin flecha.
*/
function FichaContenido({
  item,
  query,
  quienes,
  esPrioridad = false,
}: {
  item: PosicionItem;
  query: string;
  quienes: Quien[];
  esPrioridad?: boolean;
}) {
  const jugadoresWyscout = useJugadoresWyscout();
  const texto = (
    <Highlight
      text={item.CONTENIDO.replace(/\bvs\.?(?=\s)/gi, "contra").replace(/\.$/, "")}
      query={query}
    />
  );

  const d = detalle(item);

  /* 07/11/2026: si /identidad-campo mide este contenido con una métrica de
     Wyscout, se dice cuál: la etiqueta se convierte en algo que se puede
     seguir partido a partido. Sin métrica, no se escribe nada. */
  const columna = medidaDelContenido(item.POSICION ?? "", item.CONTENIDO ?? "");
  /* 08/11/2026: con la cifra del grupo (cada jugador nuestro con 450′ frente
     a la mediana del puesto en la categoría), en español y con ancla. */
  const cifra =
    jugadoresWyscout && columna
      ? cifraDelContenido(jugadoresWyscout, item.POSICION ?? "", item.CONTENIDO ?? "")
      : null;
  /*
  | 10/11/2026: un jugador por fila (nombre y minutos a la izquierda, cifra
  | con flecha a la derecha) y la mediana como última fila, separada. En una
  | sola línea con `whitespace-nowrap` la cifra se salía de la tarjeta en
  | escritorio y en el móvil se cortaba en «Joan Mart». El nombre es el de la
  | plantilla (el de los chips), no el de Wyscout. Si alguien queda por
  | debajo, la caja acaba en el objetivo para la tarea: la mediana.
  */
  /*
  | 16/11/2026: barras con marcas. Un jugador por fila sobre una escala común,
  | la raya azul de la mediana del puesto y la zona buena teñida; la cifra a
  | la derecha con su base («11 de 29», «≈ 26 en 883′»). Menos de 15 intentos
  | en un % es «tendencia»: punto hueco, sin ▲/▼. El título es la conclusión
  | con nombres; «Qué entrenamos» dice a quién, qué contar y el objetivo.
  */
  const firmes = cifra ? cifra.nuestros.filter((j) => !esTendencia(j)) : [];
  const debajo = cifra ? firmes.filter((j) => comparaConMediana(j.valor, cifra) < 0) : [];
  /* 17/11/2026 (guionista): quien iguala la mediana va aparte, no «por encima». */
  const encima = cifra ? firmes.filter((j) => comparaConMediana(j.valor, cifra) > 0) : [];
  const iguales = cifra ? firmes.filter((j) => comparaConMediana(j.valor, cifra) === 0) : [];
  const nombre = (j: JugadorCifra) => nombrePlantilla(j.nombre, quienes);
  const escala = (() => {
    if (!cifra) return { lo: 0, hi: 1 };
    const vs = [...cifra.nuestros.map((j) => j.valor), cifra.mediana];
    const lo = Math.min(...vs);
    const hi = Math.max(...vs);
    const margen = (hi - lo) * 0.25 || Math.abs(hi) * 0.2 || 1;

    return { lo: Math.max(0, lo - margen), hi: hi + margen };
  })();
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - escala.lo) / (escala.hi - escala.lo)) * 100))}%`;
  const tramos = [
    debajo.length ? `${yLista(debajo.map(nombre))}, por debajo` : "",
    encima.length ? `${yLista(encima.map(nombre))}, por encima` : "",
    iguales.length ? `${yLista(iguales.map(nombre))}, en la mediana` : "",
  ].filter(Boolean);
  const titular = !cifra
    ? ""
    : firmes.length === 0
      ? "sólo tendencia por ahora"
      : debajo.length === firmes.length && firmes.length > 1
        ? `los ${firmes.length} por debajo de la mediana`
        : encima.length === firmes.length && firmes.length > 1
          ? `los ${firmes.length} por encima de la mediana`
          : tramos.join("; ");

  const medida = columna && (
    <div className="mt-2 min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-[14px] leading-relaxed text-gray-300">
      <p className="break-words text-[13px] text-gray-400">
        <span className="font-semibold text-gray-200">Se mide en el partido:</span> {nombreColumna(columna)}
        {EXPLICA[columna] && <span className="text-gray-400"> ({EXPLICA[columna]})</span>}
      </p>
      {cifra && (
        <figure className="mt-1 min-w-0">
          <figcaption className="break-words font-semibold text-white">{titular}</figcaption>
          <ul className="mt-2 space-y-2" aria-label={`${nombreColumna(columna)} de cada jugador frente a la mediana`}>
            {cifra.nuestros.map((j) => {
              const tendencia = esTendencia(j);
              const signo = comparaConMediana(j.valor, cifra);
              const base = baseDe(j);

              return (
                <li key={j.nombre} className="grid grid-cols-[5.25rem_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:gap-3">
                  <Link
                    href={`/individual?nombre=${encodeURIComponent(j.nombre)}&pestana=mejora`}
                    className="min-w-0 truncate font-semibold text-gray-200 hover:text-white hover:underline"
                    title={`Área de mejora de ${nombre(j)} · ${j.minutos.toLocaleString("es-ES")}′`}
                  >
                    {nombre(j)}
                  </Link>
                  <span aria-hidden className="relative block h-5">
                    <span
                      className={cn(
                        "absolute inset-y-1.5 rounded-full",
                        cifra.mejorAlto ? "right-0 bg-emerald-500/15" : "left-0 bg-emerald-500/15",
                      )}
                      style={cifra.mejorAlto ? { left: pos(cifra.mediana) } : { right: `calc(100% - ${pos(cifra.mediana)})` }}
                    />
                    <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/15" />
                    <span className="absolute inset-y-0 w-0.5 bg-sky-400" style={{ left: pos(cifra.mediana) }} />
                    <span
                      className={cn(
                        "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
                        tendencia
                          ? "border-gray-400 bg-transparent"
                          : signo < 0
                            ? "border-amber-500 bg-amber-500"
                            : "border-emerald-500 bg-emerald-500",
                      )}
                      style={{ left: pos(j.valor) }}
                    />
                  </span>
                  <span className="text-right leading-tight">
                    <span
                      className={cn(
                        "block font-bold tabular-nums",
                        tendencia ? "text-gray-300" : signo === 0 ? "text-gray-200" : signo > 0 ? "text-emerald-400" : "text-amber-400",
                      )}
                    >
                      {tendencia ? "" : signo === 0 ? "= " : signo > 0 ? "▲ " : "▼ "}
                      {cifraTexto(j.valor, cifra.porcentaje)}
                    </span>
                    {(base || tendencia) && (
                      <span className="block text-[12px] tabular-nums text-gray-400">
                        {base}
                        {tendencia && " · tendencia"}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[13px] text-gray-400">
            <span aria-hidden className="inline-block h-3 w-0.5 bg-sky-400" />
            Mediana de {cifra.n} {(PLURAL_PUESTO[cifra.puesto] ?? "jugadores").toLowerCase()} de la categoría:{" "}
            <b className="tabular-nums text-gray-200">{cifraTexto(cifra.mediana, cifra.porcentaje)}</b>
          </p>
          {/* 17/11/2026 (marketing): la marca de «tendencia» con su leyenda al lado. */}
          {cifra.nuestros.some(esTendencia) && (
            <p className="mt-1 flex items-center gap-2 text-[12px] text-gray-400">
              <span aria-hidden className="inline-block h-3 w-3 rounded-full border-2 border-gray-400" />
              tendencia: menos de {MINIMO_INTENTOS} acciones o intentos, sin ▲/▼ ni tarea
            </p>
          )}
          {debajo.length > 0 && esPrioridad && (
            <p className="mt-2 break-words text-[13px] text-amber-400">
              Es el de «Por dónde empezar a entrenar», arriba: allí van la tarea y el objetivo.
            </p>
          )}
          {debajo.length > 0 && !esPrioridad && (
            <p className="mt-2 break-words rounded-lg border-l-2 border-amber-500/70 bg-amber-500/[0.06] px-3 py-2 text-gray-200">
              <span className="font-semibold text-white">Qué entrenamos · {yLista(debajo.map(nombre))}:</span> tarea de «
              {item.CONTENIDO.replace(/\bvs\.?(?=\s)/gi, "contra").replace(/\.$/, "")}»; contar{" "}
              {QUE_CONTAR[cifra.columna] ?? nombreColumna(cifra.columna).toLowerCase()}; objetivo de partido{" "}
              {cifra.mejorAlto ? "llegar a" : "bajar de"} {cifraTexto(cifra.mediana, cifra.porcentaje)}.
              {/* 17/11/2026 (marketing): el Área de mejora y el Seguimiento van una vez
                  por jugador, en sus chips de arriba; aquí, sólo el nombre enlazado en la barra. */}
            </p>
          )}
        </figure>
      )}
    </div>
  );

  if (!Object.values(d).some(Boolean)) {
    return (
      <div className="min-w-0 flex-1">
        {/* 10/11/2026: lo que no se mide pesa menos que lo medido. */}
        <p
          className={cn(
            "min-w-0 whitespace-pre-wrap break-words leading-relaxed",
            columna ? "text-[14px] text-gray-200 lg:text-[15px]" : "text-[13px] text-gray-400 lg:text-sm",
          )}
        >
          {texto}
        </p>
        {medida}
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1">
    <details className="group min-w-0">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[14px] leading-relaxed text-gray-200 lg:text-[15px] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 break-words">{texto}</span>
        <ChevronDown
          className="mt-1 h-4 w-4 shrink-0 text-[#C8A96B] transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <div className="mt-2 space-y-2 text-sm leading-relaxed text-gray-400">
        {d.definicion && <p className="whitespace-pre-wrap">{d.definicion}</p>}

        {d.queSeVe && (
          <p className="whitespace-pre-wrap">
            <span className="font-semibold text-gray-200">Qué se ve: </span>
            {d.queSeVe}
          </p>
        )}

        {d.criterio && (
          <p className="whitespace-pre-wrap">
            <span className="font-semibold text-gray-200">
              Criterio de éxito:{" "}
            </span>
            {d.criterio}
          </p>
        )}

        {d.video && (
          <a
            href={d.video}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-[#C8A96B] hover:underline"
          >
            Ver clip →
          </a>
        )}
      </div>
    </details>
    {medida}
    </div>
  );
}
