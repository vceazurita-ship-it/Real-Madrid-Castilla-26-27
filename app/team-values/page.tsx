"use client";
import { olvidaCsv, traeCsv } from "@/lib/hojaCsv";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useSaveGuard } from "@/hooks/useSaveGuard";
import { useAutoSave } from "@/hooks/useAutoSave";
import { anotaEscritas, aplicaEscritas } from "@/lib/escriturasRecientes";
import {
  AVISO_TEXTO_LARGO,
  guardaTextoEnLaHoja,
} from "@/lib/guardaTextoHoja";
import { AvisoLargo } from "@/components/conocimiento/AvisoLargo";
import {
  AutoTextarea,
  EditToolbar,
  EmptyState,
  ErrorState,
  Highlight,
  LoadingState,
  SearchField,
  focusRing,
  matches,
  useEditShortcuts,
} from "@/components/ui/knowledge-kit";
import { cn } from "@/lib/utils";
import { VALORES_INDICE, VotosValores } from "@/components/cultura/ValoresIndice";
import { TOTAL_VOTOS_VALORES } from "@/components/cultura/ResumenValores";
import { confirmar } from "@/lib/avisos";

type CulturaItem = {
  ID: number;
  SECCION: string;
  TIPO: string;
  TITULO: string;
  CONTENIDO: string;
  ORDEN: number;
  /*
  | 30/10/2026: columnas opcionales de la hoja para las dinámicas de las
  | semanas. Si alguien las añade, cada dinámica dice cuánto dura, qué
  | material lleva y qué entrega el vestuario; FECHA es la semana real de la
  | etapa. Lo que no tenga texto no se pinta.
  */
  DURACION?: string;
  MATERIAL?: string;
  ENTREGA?: string;
  FECHA?: string;
  /*
  | 20/11/2026 (jueces, ronda 6): qué se hace con la plantilla en la semana
  | de esa etapa. Columna opcional («CON LA PLANTILLA»); hoy la hoja no la
  | trae y la línea no sale.
  */
  "CON LA PLANTILLA"?: string;
};

const limpio = (t?: unknown) => String(t ?? "").trim();

/** «2026-11-17», «17/11/2026» o «17/11» (de la temporada) → «2026-11-17»; si no se entiende, "". */
function fechaIso(texto: string, anio: number): string {
  const iso = texto.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  const dmy = texto.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);

  if (!dmy) return "";

  const a = dmy[3] ? (dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]) : String(anio);

  return `${a}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
}

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1367356753&single=true&output=csv";

/** Nombre de las notas de lo recién escrito en `localStorage`. */
const ESPACIO_ESCRITAS = "team-values";

/** Descripción de cada etapa de la hoja de ruta: qué se hace con el vestuario. Las secciones nuevas caen al texto por defecto. */
const DESCRIPCIONES: Record<string, string> = {
  MARCO:
    "Antes del vestuario: qué cultura queremos y cómo la construimos.",
  PLANIFICACION:
    "Cómo se organiza el proceso: quién hace qué y en qué semana.",
  "SEMANA 1": "Con el vestuario: qué significa pertenecer a este grupo.",
  "SEMANA 2":
    "Con el vestuario: los valores y los comportamientos que se pueden ver.",
  "SEMANA 3": "Con el vestuario: los estándares y lo que no se negocia.",
  "SEMANA 4":
    "Con el vestuario: consolidar los hábitos y las herramientas de la cultura.",
};

/* 10/11/2026: el titular de cada etapa dice la idea; la etapa va encima. */
const TITULARES: Record<string, string> = {
  MARCO: "Los valores los vota la plantilla, no los impone el cuerpo técnico",
  PLANIFICACION: "Quién hace qué y en qué semana",
  "SEMANA 1": "Qué significa pertenecer a este grupo",
  "SEMANA 2": "Los valores, en conductas que se pueden ver",
  "SEMANA 3": "Los estándares y lo que no se negocia",
  "SEMANA 4": "Consolidar los hábitos de la cultura",
};

const DESCRIPCION_POR_DEFECTO =
  "Contenidos culturales de esta etapa de la hoja de ruta.";

/** Palabras que la hoja trae sin tilde. */
const TILDES: Record<string, string> = {
  planificacion: "planificación",
  elite: "élite",
  evaluacion: "evaluación",
  comunicacion: "comunicación",
  formacion: "formación",
  accion: "acción",
  organizacion: "organización",
  reflexion: "reflexión",
};

/** «PLANIFICACION» → «Planificación»; «ENFOQUE ELITE» → «Enfoque élite». Sólo para pintar. */
function rotuloSeccion(s: string): string {
  const palabras = s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => TILDES[w] ?? w);

  const frase = palabras.join(" ");

  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/** Títulos de la hoja que van mejor dichos de otra forma. */
const TITULOS: Record<string, string> = {
  "rol del staff": "Papel del cuerpo técnico",
  /* 17/11/2026 (fútbol): sin rótulos de analista. */
  "enfoque elite": "Cómo trabaja un profesional",
  "enfoque élite": "Cómo trabaja un profesional",
  "mecanica inversa": "Empezar por lo que no queremos",
  "mecánica inversa": "Empezar por lo que no queremos",
  autogestion: "El vestuario se organiza solo",
  "autogestión": "El vestuario se organiza solo",
};

/** «Quién Queremos Ser» → «Quién queremos ser»; «Rol del Staff» → «Papel del cuerpo técnico». Sólo para pintar. */
function tituloElemento(t: string): string {
  const limpio = t.trim();
  const mapa = TITULOS[limpio.toLowerCase()];

  if (mapa) return mapa;

  const frase = limpio
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w === "staff" ? "cuerpo técnico" : (TILDES[w] ?? w)))
    .join(" ");

  return frase.charAt(0).toUpperCase() + frase.slice(1);
}


const TIPO_STYLES: Record<string, string> = {
  VALOR: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
  ANTIVALOR: "bg-red-500/15 text-red-300 ring-red-500/25",
  INNEGOCIABLE: "bg-sky-500/15 text-sky-300 ring-sky-500/25",
  INTOLERABLE: "bg-orange-500/15 text-orange-300 ring-orange-500/25",
};

const TIPO_POR_DEFECTO = "bg-[#C8A96B]/15 text-[#C8A96B] ring-[#C8A96B]/25";

export default function TeamValuesPage() {
  const [data, setData] = useState<CulturaItem[]>([]);
  const [originalData, setOriginalData] = useState<CulturaItem[]>([]);

  const [seccion, setSeccion] = useState("");
  const [query, setQuery] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);

  const [saving, setSaving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  /** La etapa en la que está hoy la plantilla, si la hoja trae fechas. */
  const [etapaHoy, setEtapaHoy] = useState("");
  /** La última etapa que se sabe hecha cuando la hoja no trae fechas (la de la votación). */
  const [hechaPorVotacion, setHechaPorVotacion] = useState("");

  /* Deja rescatar el texto de los cambios que el servidor no acepte. */
  const { reportarRechazo, dialogo: avisoGuardado } = useSaveGuard();

  /* ------------------------------------------------------------ carga */

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const csv = await traeCsv(CSV_URL, { forzar: recarga > 0 });

        const parsed = Papa.parse<CulturaItem>(csv, {
          header: true,
          skipEmptyLines: true,
        });

        /* Lo guardado hace poco va encima: el CSV publicado tarda minutos en
           enterarse (`lib/escriturasRecientes.ts`). */
        const rows = aplicaEscritas(
          ESPACIO_ESCRITAS,
          parsed.data.filter((r) => r?.SECCION),
          "CONTENIDO",
        );

        if (cancelado) return;

        setData(rows);
        setOriginalData(structuredClone(rows));

        const hash = decodeURIComponent(
          window.location.hash.replace("#", ""),
        ).toUpperCase();

        /* 17/11/2026 (fútbol): si la hoja trae FECHA, la etapa de hoy es la
           última que ya ha empezado; la pantalla abre en ella. */
        const hoy = new Date();
        const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
        const empiezan = [...new Set(rows.map((r) => r.SECCION))].flatMap((s) => {
          const iso = rows.filter((r) => r.SECCION === s).map((r) => fechaIso(limpio(r.FECHA), hoy.getFullYear())).find(Boolean);

          return iso ? [{ s, iso }] : [];
        });
        const porFecha = empiezan.filter((e) => e.iso <= hoyIso).sort((a, b) => a.iso.localeCompare(b.iso)).pop()?.s ?? "";

        /* 27/11/2026 (jueces, ronda 9): la hoja no trae FECHA, pero la
           votación de los valores ya está hecha (el documento de valores
           tiene su recuento). La etapa que trae los VALOR y las de antes salen
           hechas, y la siguiente es la que toca ahora. */
        const ordenSecciones = [...new Set(rows.map((r) => r.SECCION))];
        const iValores = ordenSecciones.findIndex((s) =>
          rows.some((r) => r.SECCION === s && limpio(r.TIPO).toUpperCase() === "VALOR"),
        );
        const votada = !porFecha && VALORES_INDICE.length > 0 && iValores >= 0 ? ordenSecciones[iValores] : "";
        const deHoy = porFecha || (votada ? (ordenSecciones[iValores + 1] ?? "") : "");

        setEtapaHoy(deHoy);
        setHechaPorVotacion(votada);

        const inicial =
          rows.find((r) => r.SECCION.toUpperCase() === hash)?.SECCION ??
          (deHoy || rows[0]?.SECCION) ??
          "";

        setSeccion((actual) => actual || inicial);
        setError(null);
      } catch (err) {
        if (cancelado) return;

        setError(
          err instanceof Error
            ? err.message
            : "Error desconocido al leer la hoja de cálculo.",
        );
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [recarga]);

  const recargar = useCallback(() => {
    setLoading(true);
    setError(null);
    setRecarga((n) => n + 1);
  }, []);

  /* ------------------------------------------------------------ derivados */

  const secciones = useMemo(
    () => [...new Set(data.map((r) => r.SECCION))],
    [data],
  );

  /** Solo los tipos presentes en la etapa actual: filtrar por uno vacío no aporta nada. */
  const tipos = useMemo(
    () =>
      [
        ...new Set(
          data
            .filter((r) => r.SECCION === seccion)
            .map((r) => r.TIPO)
            .filter(Boolean),
        ),
      ].sort(),
    [data, seccion],
  );

  // Al cambiar de etapa, un filtro de tipo que ya no existe dejaría la lista vacía sin motivo.
  const tipoActivo =
    tipoFiltro && tipos.includes(tipoFiltro) ? tipoFiltro : null;

  /** Filtros de búsqueda: se desactivan durante la edición para no ocultar lo que se escribe. */
  const visibles = useMemo(() => {
    if (editing) return data;

    return data.filter(
      (r) =>
        (!tipoActivo || r.TIPO === tipoActivo) &&
        matches(query, r.TITULO, r.CONTENIDO, r.TIPO),
    );
  }, [data, editing, query, tipoActivo]);

  const contenidos = useMemo(
    () =>
      visibles
        .filter((r) => r.SECCION === seccion)
        .sort((a, b) => Number(a.ORDEN) - Number(b.ORDEN)),
    [visibles, seccion],
  );

  const totalSeccion = useMemo(
    () => data.filter((r) => r.SECCION === seccion).length,
    [data, seccion],
  );

  const etapaIndex = secciones.indexOf(seccion);

  /* La semana real de la etapa, si la hoja la trae en FECHA. */
  const fechaEtapa = useMemo(
    () =>
      data
        .filter((r) => r.SECCION === seccion)
        .map((r) => limpio(r.FECHA))
        .find(Boolean) ?? "",
    [data, seccion],
  );
  const filtrando = !editing && (query.trim() !== "" || tipoActivo !== null);

  /* ------------------------------------------------------------ navegación */

  const irASeccion = useCallback((valor: string) => {
    setSeccion(valor);
    window.history.replaceState(null, "", `#${encodeURIComponent(valor)}`);
  }, []);

  const saltarEtapa = (delta: number) => {
    const destino = secciones[etapaIndex + delta];
    if (destino) {
      irASeccion(destino);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  /* ------------------------------------------------------------ edición */

  /*
  | Foto del contenido al entrar en edición. No es `originalData`, que el
  | autoguardado va adelantando conforme se escribe: ésta se queda quieta y es
  | a la que vuelve «Deshacer».
  */
  const [alEntrar, setAlEntrar] = useState<CulturaItem[]>([]);

  const entrarEnEdicion = () => {
    setAlEntrar(structuredClone(data));

    setQuery("");
    setTipoFiltro(null);
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
  | respecto a la última versión confirmada.
  */

  const baseRef = useRef(originalData);

  useEffect(() => {
    baseRef.current = originalData;
  });

  /* Huella del último fallo que ya se enseñó; se borra con un guardado bueno. */
  const rechazoAvisado = useRef<string | null>(null);

  const escribirCambios = useCallback(
    async (actual: CulturaItem[]) => {
      const pendientes = actual.filter((item) => {
        const original = baseRef.current.find((o) => o.ID === item.ID);

        return original && original.CONTENIDO !== item.CONTENIDO;
      });

      if (pendientes.length === 0) return true;

      /* Un texto largo no cabe en la dirección del GET: ver
         `lib/guardaTextoHoja.ts` (19/10/2026). */
      const resultados = await Promise.allSettled(
        pendientes.map((p) =>
          guardaTextoEnLaHoja("guardarCultura", {
            ID: p.ID,
            CONTENIDO: p.CONTENIDO,
          }),
        ),
      );

      /* Una respuesta de error también es un cambio perdido: contarla como
         éxito solo porque la petición llegó a completarse es justo lo que
         hace que el texto desaparezca sin avisar. */
      const fallidos = pendientes.filter((_, indice) => {
        const resultado = resultados[indice];

        return resultado.status === "rejected" || !resultado.value.ok;
      });

      const porLargo = resultados.some(
        (r) => r.status === "fulfilled" && !r.value.ok && r.value.largo,
      );

      /* Lo que sí ha llegado se apunta, para que una recarga no enseñe el
         CSV de antes. */
      anotaEscritas(
        ESPACIO_ESCRITAS,
        Object.fromEntries(
          pendientes
            .filter((p) => !fallidos.includes(p))
            .map((p) => [String(p.ID), p.CONTENIDO]),
        ),
      );

      if (fallidos.length > 0) {
        const campos = Object.fromEntries(
          fallidos.map((p) => [
            `${p.SECCION} · ${p.TITULO || p.ID}`,
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
            titulo: "Valores de equipo · cambios sin guardar",
            campos,
          });

          if (porLargo) {
            toast.error(AVISO_TEXTO_LARGO.titulo, {
              description: AVISO_TEXTO_LARGO.descripcion,
              duration: 12000,
            });
          }
        }

        return false;
      }

      rechazoAvisado.current = null;

      /* La copia de la hoja en esta pestaña ya no vale: sin tirarla, al
         volver a la pantalla se leía el texto de antes, y la siguiente
         edición partía de él y machacaba lo guardado. */
      olvidaCsv(CSV_URL);

      setOriginalData(structuredClone(actual));

      return true;
    },
    [reportarRechazo],
  );

  const auto = useAutoSave<CulturaItem[]>({
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

    try {
      await auto.flush();
    } finally {
      setSaving(false);
    }

    setEditing(false);
  }, [auto]);

  useEditShortcuts({
    editing,
    onSave: terminarEdicion,
    onCancel: salirDeEdicion,
  });

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

  /*
  | 20/11/2026 (jueces, ronda 6): vuelve el gráfico. Lo primero bajo el titular
  | son las barras de la votación (la versión reducida del de
  | /identidad-cultura), con el más votado y su base; en todas las etapas.
  */
  const votacion = !editing ? (
    <div className="mt-6 rounded-2xl border border-[#C8A96B]/40 bg-[#C8A96B]/[0.07] p-4 max-sm:pr-12 sm:p-5">
      <VotosValores compacto />
    </div>
  ) : null;

  /* Lo que se hace con la plantilla en la etapa elegida: sólo si la hoja lo trae. */
  const conLaPlantilla = data
    .filter((r) => r.SECCION === seccion)
    .map((r) => limpio(r["CON LA PLANTILLA"]))
    .find(Boolean);

  /*
  | 20/11/2026 (fútbol, marketing y guionista): las etapas salían tres veces
  | (rail, línea de pasos y la rejilla «Lo que trae cada una de las etapas»).
  | Queda una sola navegación: la línea de pasos, con el estado de cada etapa
  | (si la hoja trae FECHA) y sus contenidos.
  */


  return (
    <div className="flex min-h-screen bg-[#0B0F14]">
      <Sidebar />

      <div className="flex-1 min-w-0">
        <Topbar />

        {/* 20/11/2026 (guionista, ronda 5): sin la columna izquierda, que en
            escritorio sólo tenía el buscador; el buscador va con los filtros. */}
        <div className="flex flex-col">
          {/* ---------------------------------------------- contenido */}

          {/* 07/11/2026: sin el pr-12 del móvil (descentraba las tarjetas
              frente al selector de etapas); pb-24 para que el ⋮ flotante no
              tape la última. */}
          <main
            className={cn(
              "min-w-0 flex-1 p-4 pb-24 lg:p-8 lg:pb-24",
              editing && "pb-32 lg:pb-32",
            )}
          >
            {/* Título + acciones */}
            <div className="flex flex-row items-start justify-between gap-4">
              <div className="min-w-0">
                {/* 10/11/2026: la etapa como antetítulo y un titular con la idea. */}
                {/* 20/11/2026 (marketing): sin el antetítulo suelto («MARCO»): la etapa ya va en oro en la línea de pasos. */}
                {/* 27/11/2026 (fútbol y guionista, ronda 9): en qué etapa está el
                    proceso y qué toca ahora, antes del titular de la etapa que se ve. */}
                {etapaHoy && !editing && (
                  <p className="text-sm font-semibold text-[color:var(--rmcf-gold-ink,#C8A96B)]">
                    {seccion === etapaHoy
                      ? `Toca ahora · ${rotuloSeccion(etapaHoy)} · etapa ${secciones.indexOf(etapaHoy) + 1} de ${secciones.length}`
                      : `El proceso está en ${rotuloSeccion(etapaHoy)}: ${TITULARES[etapaHoy] ?? rotuloSeccion(etapaHoy)}`}
                    {seccion !== etapaHoy && (
                      <button
                        type="button"
                        onClick={() => irASeccion(etapaHoy)}
                        className={cn("ml-2 rounded font-semibold underline-offset-2 hover:underline", focusRing)}
                      >
                        Ir a la etapa →
                      </button>
                    )}
                  </p>
                )}
                <h1 className="mt-1 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
                  {seccion ? TITULARES[seccion] ?? rotuloSeccion(seccion) : ""}
                </h1>

                {fechaEtapa && (
                  <p className="mt-2 text-sm font-medium text-[#C8A96B]">
                    {fechaEtapa}
                  </p>
                )}

                <p className="mt-3 max-w-2xl text-sm text-gray-400 lg:text-base">
                  {DESCRIPCIONES[seccion] ??
                    (seccion ? DESCRIPCION_POR_DEFECTO : "")}
                </p>

                {hechaPorVotacion && !editing && (
                  <p className="mt-2 max-w-2xl text-sm text-gray-300">
                    {seccion === etapaHoy
                      ? `Hecho: hasta ${rotuloSeccion(hechaPorVotacion)}, con la votación de los valores (${TOTAL_VOTOS_VALORES} votos de la plantilla). Esta etapa trae ${totalSeccion} contenido${totalSeccion === 1 ? "" : "s"}, en orden, debajo.`
                      : secciones.indexOf(seccion) <= secciones.indexOf(hechaPorVotacion)
                        ? "Etapa hecha: la votación de los valores ya cerró."
                        : "Etapa por hacer."}
                  </p>
                )}
              </div>

              {!editing && !loading && !error && toolbar}
            </div>

            {votacion}

            {/* 16/11/2026: la hoja de ruta como línea de proceso: las seis
                etapas en orden, con su fecha si la hoja la trae; la que se ve,
                en oro. En el móvil sustituye a la rejilla del rail. */}
            {secciones.length > 1 && (
              <ol
                aria-label="Hoja de ruta de la cultura"
                className="mt-6 grid grid-cols-3 gap-y-4 sm:flex sm:gap-0"
              >
                {secciones.map((s, i) => {
                  const activa = s === seccion;
                  const hecha = (etapaHoy ? secciones.indexOf(etapaHoy) : etapaIndex) > i;
                  const fecha = data
                    .filter((r) => r.SECCION === s)
                    .map((r) => limpio(r.FECHA))
                    .find(Boolean);
                  const n = visibles.filter((r) => r.SECCION === s).length;
                  /* El estado sólo cuando la hoja dice en qué etapa estamos (FECHA): sin fecha, no se nombra. */
                  const estadoEtapa = etapaHoy ? (s === etapaHoy ? (hechaPorVotacion ? "Toca ahora" : "En curso") : hecha ? "Hecha" : "Por hacer") : "";
                  /* 27/11/2026 (marketing, ronda 9): el primer contenido de la etapa, no sólo «2 contenidos». */
                  const deLaEtapa = visibles
                    .filter((r) => r.SECCION === s)
                    .sort((a, b) => Number(a.ORDEN) - Number(b.ORDEN));
                  const primero = deLaEtapa[0] ? tituloElemento(deLaEtapa[0].TITULO) : "";

                  return (
                    <li key={s} className="relative min-w-0 flex-1">
                      {i > 0 && (
                        <span
                          aria-hidden
                          className={cn(
                            "absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 max-sm:hidden",
                            hecha || activa ? "bg-[#C8A96B]" : "bg-white/15",
                          )}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => irASeccion(s)}
                        aria-current={activa ? "step" : undefined}
                        className={cn("relative z-10 flex w-full flex-col items-center gap-1 px-1 text-center", focusRing)}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                            activa
                              ? "bg-[#C8A96B] text-black shadow-[0_6px_18px_-8px_rgba(200,169,107,0.9)]"
                              : hecha
                                ? "bg-[#C8A96B]/25 text-[color:var(--rmcf-gold-ink,#C8A96B)]"
                                : "bg-[#11161C] text-gray-300 ring-1 ring-white/15",
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className={cn("text-sm leading-tight", activa ? "font-semibold text-white" : "text-gray-300")}>
                          {rotuloSeccion(s)}
                        </span>
                        {fecha && <span className="text-[12px] text-gray-400">{fecha}</span>}
                        {primero ? (
                          <span className="max-w-full break-words text-[12px] leading-snug text-gray-400">
                            {primero}
                            {n > 1 && <span className="tabular-nums text-gray-500"> · +{n - 1}</span>}
                          </span>
                        ) : (
                          <span className={cn("text-[12px] tabular-nums", filtrando ? "text-gray-500" : "text-gray-400")}>
                            {n} contenido{n === 1 ? "" : "s"}
                          </span>
                        )}
                        {estadoEtapa && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                              estadoEtapa === "En curso" || estadoEtapa === "Toca ahora" ? "bg-sky-500/15 text-sky-300 ring-sky-500/30" : estadoEtapa === "Hecha" ? "text-[color:var(--rmcf-gold-ink,#C8A96B)] ring-[#C8A96B]/30" : "text-gray-400 ring-white/15",
                            )}
                          >
                            {estadoEtapa}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}

            {!editing && conLaPlantilla && (
              <p className="mt-4 rounded-xl border-l-2 border-[#C8A96B]/60 bg-white/[0.03] px-3 py-2 text-sm leading-relaxed text-gray-200">
                <span className="font-semibold text-white">Esta semana con la plantilla:</span> {conLaPlantilla}
              </p>
            )}

            {/* Buscador y filtros por tipo */}
            {!editing && (
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Buscar valor o conducta…"
                label="Buscar en los contenidos culturales"
                className="mt-6 max-w-md"
              />
            )}
            {!editing && tipos.length > 1 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTipoFiltro(null)}
                  aria-pressed={tipoActivo === null}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors",
                    focusRing,
                    tipoActivo === null
                      ? "bg-white/[0.12] text-white ring-white/20"
                      : "text-gray-400 ring-white/10 hover:text-white",
                  )}
                >
                  Todos
                </button>

                {tipos.map((t) => {
                  const total = data.filter(
                    (r) => r.SECCION === seccion && r.TIPO === t,
                  ).length;

                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipoFiltro(tipoActivo === t ? null : t)}
                      aria-pressed={tipoActivo === t}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors",
                        focusRing,
                        TIPO_STYLES[t] ?? TIPO_POR_DEFECTO,
                        tipoActivo === t
                          ? "ring-2"
                          : "opacity-70 hover:opacity-100",
                      )}
                    >
                      {t}
                      {total > 0 && (
                        <span className="ml-1.5 tabular-nums opacity-70">
                          {total}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Lista */}
            <div className="mt-6">
              {loading ? (
                <LoadingState />
              ) : error ? (
                <ErrorState message={error} onRetry={recargar} />
              ) : contenidos.length === 0 ? (
                filtrando ? (
                  <EmptyState
                    icon={<SearchX className="h-6 w-6" aria-hidden />}
                    title="Sin resultados en esta etapa"
                    hint={
                      totalSeccion > 0
                        ? `«${rotuloSeccion(seccion)}» tiene ${totalSeccion} contenidos, pero ninguno coincide con el filtro. Prueba en otra etapa de la hoja de ruta.`
                        : "Prueba con otra búsqueda o cambia de etapa."
                    }
                    action={
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setTipoFiltro(null);
                        }}
                        className={cn(
                          "rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/10",
                          focusRing,
                        )}
                      >
                        Limpiar filtros
                      </button>
                    }
                  />
                ) : (
                  <EmptyState
                    title="Esta etapa aún no tiene contenidos"
                    hint="Añádelos desde la hoja de cálculo de la hoja de ruta de la cultura."
                  />
                )
              ) : (
                <>
                  {filtrando && (
                    <p className="mb-3 text-xs text-gray-500">
                      {contenidos.length} de {totalSeccion} contenidos
                    </p>
                  )}

                  {/* 20/11/2026 (tres expertos, ronda 5): la etapa elegida enseña siempre
                      sus contenidos; el Marco ya no los pliega bajo «El método». */}
                  <ul className={cn("grid gap-3", !editing && "lg:grid-cols-2")}>
                    {contenidos.map((p) => (
                      <li
                        key={p.ID}
                        className="group rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-4 transition-all hover:border-[#C8A96B]/40 hover:bg-white/[0.05] lg:rounded-3xl lg:p-6"
                      >
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#C8A96B] text-xs font-bold tabular-nums text-black lg:h-12 lg:w-12 lg:text-lg">
                            {p.ORDEN}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                              <h3 className="break-words text-base font-semibold text-white lg:text-lg">
                                <Highlight text={tituloElemento(p.TITULO)} query={query} />
                              </h3>

                              {p.TIPO && tipos.length > 1 && (
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1",
                                    TIPO_STYLES[p.TIPO] ?? TIPO_POR_DEFECTO,
                                  )}
                                >
                                  {p.TIPO}
                                </span>
                              )}
                            </div>

                            {editing ? (
                              <>
                                <AutoTextarea
                                  value={p.CONTENIDO}
                                  aria-label={`Contenido de ${tituloElemento(p.TITULO)}`}
                                  onChange={(e) =>
                                    setData((prev) =>
                                      prev.map((item) =>
                                        item.ID === p.ID
                                          ? { ...item, CONTENIDO: e.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                                <AvisoLargo texto={p.CONTENIDO} />
                              </>
                            ) : (
                              <>
                                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300 lg:text-base">
                                  <Highlight text={p.CONTENIDO} query={query} />
                                </p>

                                {/* 27/11/2026 (guionista, ronda 9): sin los enlaces al
                                    seguimiento y a las conductas en la tarjeta
                                    «Conductas reales»: ya están bajo la votación. */}

                                {/* Ficha de la dinámica: sólo lo que la hoja traiga. */}
                                {(limpio(p.DURACION) || limpio(p.MATERIAL) || limpio(p.ENTREGA)) && (
                                  <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                                    {([
                                      ["Duración", p.DURACION],
                                      ["Material", p.MATERIAL],
                                      ["Entrega el vestuario", p.ENTREGA],
                                    ] as const)
                                      .filter(([, v]) => limpio(v))
                                      .map(([k, v]) => (
                                        <div key={k} className="min-w-0">
                                          <dt className="text-xs text-gray-500">{k}</dt>
                                          <dd className="break-words text-gray-200">{limpio(v)}</dd>
                                        </div>
                                      ))}
                                  </dl>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* Etapa anterior / siguiente */}
            {!loading && !error && secciones.length > 1 && (
              <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/10 pt-6">
                <button
                  type="button"
                  onClick={() => saltarEtapa(-1)}
                  disabled={etapaIndex <= 0}
                  className={cn(
                    "inline-flex min-w-0 items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:invisible",
                    focusRing,
                  )}
                >
                  <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex min-w-0 flex-col items-start text-left">
                    <span className="text-[11px] uppercase tracking-wider text-gray-500">
                      Etapa anterior
                    </span>
                    <span className="max-w-full truncate">
                      {rotuloSeccion(secciones[etapaIndex - 1] ?? "")}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => saltarEtapa(1)}
                  disabled={etapaIndex >= secciones.length - 1}
                  className={cn(
                    "inline-flex min-w-0 items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:invisible",
                    focusRing,
                  )}
                >
                  <span className="flex min-w-0 flex-col items-end text-right">
                    <span className="text-[11px] uppercase tracking-wider text-gray-500">
                      Siguiente etapa
                    </span>
                    <span className="max-w-full truncate font-semibold text-white">
                      {rotuloSeccion(secciones[etapaIndex + 1] ?? "")}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                </button>
              </div>
            )}

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

      {avisoGuardado}
    </div>
  );
}
