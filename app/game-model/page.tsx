"use client";
import { olvidaCsv, traeCsv, traeJson } from "@/lib/hojaCsv";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  SearchX,
  Shield,
  Swords,
  Target,
} from "lucide-react";

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
  SectionLabel,
  focusRing,
  matches,
  useEditShortcuts,
} from "@/components/ui/knowledge-kit";
import { cn } from "@/lib/utils";
import { confirmar } from "@/lib/avisos";
import {
  cifrasDelModelo,
  medidaDelPrincipio,
  type CifraDelPrincipio,
} from "@/lib/identidad/campo";
import { formatea } from "@/lib/data-analisis/metricas";
import type { FilaPartido } from "@/lib/data-analisis/leer";

type Principio = {
  ID: number;
  FASE: string;
  BLOQUE: string;
  APARTADO: string;
  PRINCIPIO: string;
  ORDEN: number;
  /*
  | 30/10/2026: columnas opcionales de la hoja. Hoy existen OBSERVACIONES y
  | VIDEO (vacías) y ACTIVO; DESCRIPCION, QUE_SE_VE y CRITERIO se leen si
  | alguien las añade. El texto es del cuerpo técnico: aquí no se escribe
  | ninguna definición, sólo se enseña lo que la hoja traiga.
  */
  DESCRIPCION?: string;
  OBSERVACIONES?: string;
  QUE_SE_VE?: string;
  CRITERIO?: string;
  VIDEO?: string;
  ACTIVO?: string;
};

/** Lo que se despliega bajo un principio; sólo lo que tiene texto. */
const detalle = (p: Principio) => {
  const limpio = (t?: string) => (t ?? "").trim();

  return {
    definicion: limpio(p.DESCRIPCION) || limpio(p.OBSERVACIONES),
    queSeVe: limpio(p.QUE_SE_VE),
    criterio: limpio(p.CRITERIO),
    video: /^https?:\/\//i.test(limpio(p.VIDEO)) ? limpio(p.VIDEO) : "",
  };
};

const tieneDetalle = (p: Principio) =>
  Object.values(detalle(p)).some(Boolean);

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1322156567&single=true&output=csv";

/** Nombre de las notas de lo recién escrito en `localStorage`. */
const ESPACIO_ESCRITAS = "game-model";

/** Orden preferido de las fases; cualquier otra se añade detrás en el orden de la hoja. */
const ORDEN_FASES = ["ATAQUE", "DEFENSA"];

const ICONO_FASE: Record<string, typeof Swords> = {
  ATAQUE: Swords,
  DEFENSA: Shield,
};

type Ruta = { bloque: string; apartado: string };

const primerBloque = (rows: Principio[], fase: string) =>
  rows.find((r) => r?.FASE === fase)?.BLOQUE ?? "";

const primerApartado = (rows: Principio[], fase: string, bloque: string) =>
  rows.find((r) => r?.FASE === fase && r?.BLOQUE === bloque)?.APARTADO ?? "";

const RE_CLAVE = /\s*CLAVE\.?\s*$/i;
const esClave = (t: string) => RE_CLAVE.test(t);
const quitaClave = (t: string) => t.replace(RE_CLAVE, "").trim();

export default function GameModelPage() {
  const [data, setData] = useState<Principio[]>([]);
  const [originalData, setOriginalData] = useState<Principio[]>([]);

  const [fase, setFase] = useState("");
  const [bloque, setBloque] = useState("");
  const [apartado, setApartado] = useState("");

  const [query, setQuery] = useState("");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  /* Deja rescatar el texto de los principios que el servidor no acepte. */
  const { reportarRechazo, dialogo: avisoGuardado } = useSaveGuard();

  /* ------------------------------------------------------------ carga */

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const csv = await traeCsv(CSV_URL, { forzar: recarga > 0 });

        const parsed = Papa.parse<Principio>(csv, {
          header: true,
          skipEmptyLines: true,
        });

        /* Lo guardado hace poco va encima: el CSV publicado tarda minutos en
           enterarse (`lib/escriturasRecientes.ts`). */
        const rows = aplicaEscritas(
          ESPACIO_ESCRITAS,
          /* Un principio con ACTIVO = FALSE en la hoja está retirado. */
          parsed.data.filter(
            (r) =>
              r?.FASE &&
              r?.BLOQUE &&
              String(r.ACTIVO ?? "").trim().toUpperCase() !== "FALSE",
          ),
          "PRINCIPIO",
        );

        if (cancelado) return;

        setData(rows);
        setOriginalData(structuredClone(rows));

        // Enlace profundo: #FASE, o #FASE|BLOQUE|APARTADO
        const [hFase = "", hBloque = "", hApartado = ""] = decodeURIComponent(
          window.location.hash.replace("#", ""),
        ).split("|");

        const faseInicial =
          rows.find((r) => r.FASE === hFase.toUpperCase())?.FASE ??
          rows.find((r) => r.FASE === "ATAQUE")?.FASE ??
          rows[0]?.FASE ??
          "";

        const bloqueInicial =
          rows.find((r) => r.FASE === faseInicial && r.BLOQUE === hBloque)
            ?.BLOQUE ?? primerBloque(rows, faseInicial);

        const apartadoInicial =
          rows.find(
            (r) =>
              r.FASE === faseInicial &&
              r.BLOQUE === bloqueInicial &&
              r.APARTADO === hApartado,
          )?.APARTADO ?? primerApartado(rows, faseInicial, bloqueInicial);

        setFase(faseInicial);
        setBloque(bloqueInicial);
        setApartado(apartadoInicial);
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

  const fases = useMemo(() => {
    const encontradas = [...new Set(data.map((r) => r.FASE))];

    return encontradas.sort((a, b) => {
      const ia = ORDEN_FASES.indexOf(a);
      const ib = ORDEN_FASES.indexOf(b);

      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;

      return ia - ib;
    });
  }, [data]);

  /** Los filtros de texto se desactivan al editar para no ocultar lo que se escribe. */
  const visibles = useMemo(
    /* 30/10/2026: el buscador mira también la definición, qué se ve y el criterio. */
    () =>
      editing
        ? data
        : data.filter((r) => {
            const d = detalle(r);

            return matches(query, [r.PRINCIPIO, d.definicion, d.queSeVe, d.criterio].filter(Boolean).join(" · "));
          }),
    [data, editing, query],
  );

  const bloques = useMemo(
    () => [...new Set(data.filter((r) => r.FASE === fase).map((r) => r.BLOQUE))],
    [data, fase],
  );

  const apartados = useMemo(
    () => [
      ...new Set(
        data
          .filter((r) => r.FASE === fase && r.BLOQUE === bloque)
          .map((r) => r.APARTADO),
      ),
    ],
    [data, fase, bloque],
  );

  const principios = useMemo(
    () =>
      visibles
        .filter(
          (r) =>
            r.FASE === fase && r.BLOQUE === bloque && r.APARTADO === apartado,
        )
        .sort((a, b) => Number(a.ORDEN) - Number(b.ORDEN)),
    [visibles, fase, bloque, apartado],
  );

  const totalApartado = useMemo(
    () =>
      data.filter(
        (r) => r.FASE === fase && r.BLOQUE === bloque && r.APARTADO === apartado,
      ).length,
    [data, fase, bloque, apartado],
  );

  /** Recorrido plano bloque → apartado de la fase actual, para navegar con anterior/siguiente. */
  const ruta = useMemo(() => {
    const out: Ruta[] = [];
    const vistos = new Set<string>();

    data
      .filter((r) => r.FASE === fase)
      .forEach((r) => {
        const clave = `${r.BLOQUE}|${r.APARTADO}`;
        if (vistos.has(clave)) return;

        vistos.add(clave);
        out.push({ bloque: r.BLOQUE, apartado: r.APARTADO });
      });

    return out;
  }, [data, fase]);

  /* 29/10/2026: si el bloque sólo tiene un apartado («GENÉRICO»), repetirlo en el botón no aporta nada. */
  const normaliza = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toLowerCase();

  /* 29/10/2026: «GENÉRICO» (o un apartado igual al bloque) tampoco se repite en el botón aunque el bloque tenga varios. */
  const esGenerico = (a?: string, b?: string) =>
    !!a && (normaliza(a) === "generico" || normaliza(a) === normaliza(b ?? ""));

  const sinRotuloApartado = (i: number) =>
    apartadoUnico(ruta[i]?.bloque) || esGenerico(ruta[i]?.apartado, ruta[i]?.bloque);

  const apartadoUnico = (b?: string) => ruta.filter((x) => x.bloque === b).length === 1;

  const rutaIndex = ruta.findIndex(
    (r) => r.bloque === bloque && r.apartado === apartado,
  );

  const filtrando = !editing && query.trim() !== "";

  /** «Genérico» (o un apartado que repite el bloque) no es un titular: se usa fase y bloque. */
  const titular = (() => {
    const norm = (t: string) =>
      t
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim()
        .toLowerCase();
    const generico =
      norm(apartado) === "generico" || norm(apartado) === norm(bloque);

    if (!generico || !bloque) return apartado;

    return [fase, bloque].filter(Boolean).join(" · ");
  })();

  /** Principios marcados «CLAVE» en la hoja: lo que no se negocia. */
  const claves = principios.filter((p) => esClave(p.PRINCIPIO));

  /* ------------------------------------------------------------ navegación */

  const sincronizarHash = useCallback((f: string, b: string, a: string) => {
    window.history.replaceState(
      null,
      "",
      `#${encodeURIComponent([f, b, a].join("|"))}`,
    );
  }, []);

  const seleccionarFase = useCallback(
    (f: string) => {
      const b = primerBloque(data, f);
      const a = primerApartado(data, f, b);

      setFase(f);
      setBloque(b);
      setApartado(a);
      sincronizarHash(f, b, a);
    },
    [data, sincronizarHash],
  );

  const seleccionarBloque = useCallback(
    (b: string) => {
      const a = primerApartado(data, fase, b);

      setBloque(b);
      setApartado(a);
      sincronizarHash(fase, b, a);
    },
    [data, fase, sincronizarHash],
  );

  const seleccionarApartado = useCallback(
    (a: string) => {
      setApartado(a);
      sincronizarHash(fase, bloque, a);
    },
    [fase, bloque, sincronizarHash],
  );

  const saltar = (delta: number) => {
    const destino = ruta[rutaIndex + delta];
    if (!destino) return;

    setBloque(destino.bloque);
    setApartado(destino.apartado);
    sincronizarHash(fase, destino.bloque, destino.apartado);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ------------------------------------------------------------ edición */

  /*
  | Foto de los principios al entrar en edición. No es `originalData`, que el
  | autoguardado va adelantando conforme se escribe: ésta se queda quieta y es
  | a la que vuelve «Deshacer».
  */
  const [alEntrar, setAlEntrar] = useState<Principio[]>([]);

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
            return inicial && inicial.PRINCIPIO !== item.PRINCIPIO;
          }).length
        : 0,
    [data, editing, alEntrar],
  );

  /*
  |--------------------------------------------------------------------------
  | AUTOGUARDADO
  |--------------------------------------------------------------------------
  |
  | En edición no hay botón de guardar: cada principio sale hacia la hoja unos
  | segundos después de dejar de escribirlo. Sólo viajan los que han cambiado
  | respecto a la última versión confirmada, así que tocar uno no reenvía los
  | doscientos que hay en el modelo.
  */

  const baseRef = useRef(originalData);

  useEffect(() => {
    baseRef.current = originalData;
  });

  /* Huella del último fallo que ya se enseñó; se borra con un guardado bueno. */
  const rechazoAvisado = useRef<string | null>(null);

  const escribirCambios = useCallback(
    async (actual: Principio[]) => {
      const pendientes = actual.filter((item) => {
        const original = baseRef.current.find((o) => o.ID === item.ID);

        return original && original.PRINCIPIO !== item.PRINCIPIO;
      });

      if (pendientes.length === 0) return true;

      /* Un texto largo no cabe en la dirección del GET: ver
         `lib/guardaTextoHoja.ts` (19/10/2026). */
      const resultados = await Promise.allSettled(
        pendientes.map((p) =>
          guardaTextoEnLaHoja("guardarPrincipio", {
            ID: p.ID,
            PRINCIPIO: p.PRINCIPIO,
          }),
        ),
      );

      /* Una respuesta de error también es un principio perdido: darla por
         buena porque la petición se completó es lo que hace que el texto
         desaparezca sin avisar. */
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
            .map((p) => [String(p.ID), p.PRINCIPIO]),
        ),
      );

      if (fallidos.length > 0) {
        const campos = Object.fromEntries(
          fallidos.map((p) => [
            `${p.FASE} · ${p.BLOQUE} · ${p.APARTADO || p.ID}`,
            p.PRINCIPIO,
          ]),
        );

        /* El autoguardado reintenta solo: el aviso sale una vez por fallo
           distinto, no en cada reintento ni en cada tecla (07/10/2026). Se
           mira qué principios fallan, no lo que dicen. */
        const huella = JSON.stringify(Object.keys(campos).sort());

        if (rechazoAvisado.current !== huella) {
          rechazoAvisado.current = huella;

          reportarRechazo({
            titulo: "Modelo de juego · principios sin guardar",
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

  const auto = useAutoSave<Principio[]>({
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

  return (
    <div className="flex min-h-screen bg-[#0B0F14]">
      <Sidebar />

      <div className="flex-1 min-w-0">
        <Topbar />

        <div className="flex flex-col lg:flex-row">
          {/* ---------------------------------------------- rail izquierdo */}

          <aside
            aria-label="Estructura del modelo de juego"
            className="w-full border-white/10 p-4 lg:w-[300px] lg:shrink-0 lg:border-r lg:p-6 xl:w-[340px]"
          >
            {/* Fase */}
            <div
              role="tablist"
              aria-label="Fase del juego"
              className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1"
            >
              {fases.map((f) => {
                const Icono = ICONO_FASE[f] ?? Target;
                const activa = fase === f;

                return (
                  <button
                    key={f}
                    role="tab"
                    type="button"
                    aria-selected={activa}
                    onClick={() => seleccionarFase(f)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all",
                      focusRing,
                      activa
                        ? "bg-[#C8A96B] text-black shadow-[0_8px_24px_-12px_rgba(200,169,107,0.9)]"
                        : "text-gray-400 hover:bg-white/[0.05] hover:text-white",
                    )}
                  >
                    <Icono className="h-4 w-4" aria-hidden />
                    {f}
                  </button>
                );
              })}

              {fases.length === 0 && (
                <div className="h-10 flex-1 animate-pulse rounded-xl bg-white/[0.04]" />
              )}
            </div>

            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Buscar principio…"
              label="Buscar en los principios del modelo"
              className={cn("mt-4", editing && "pointer-events-none opacity-40")}
            />

            {/* Bloques */}
            <SectionLabel className="mt-4 mb-2 text-xs text-gray-400 lg:mt-6 lg:mb-3">Bloques</SectionLabel>

            {/*
            | 30/10/2026: en el móvil la tira horizontal cortaba el nombre
            | («Progresión desde campo pr…») sin decir que se podía deslizar.
            | Ahora es una rejilla de dos columnas con el nombre entero en
            | varias líneas, y el contador dice qué cuenta («6 principios»).
            */}
            <nav className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {bloques.map((b) => {
                const total = visibles.filter(
                  (r) => r.FASE === fase && r.BLOQUE === b,
                ).length;

                if (!editing && !filtrando && total === 0) return null;

                const activo = bloque === b;

                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => seleccionarBloque(b)}
                    aria-current={activo ? "true" : undefined}
                    className={cn(
                      "flex min-w-0 flex-row items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-left transition-all lg:flex-row lg:items-center lg:justify-between lg:gap-3 lg:rounded-2xl lg:px-4 lg:py-3",
                      focusRing,
                      activo
                        ? "bg-[#C8A96B] text-black shadow-[0_8px_24px_-12px_rgba(200,169,107,0.9)]"
                        : "border border-white/10 text-gray-200 hover:border-[#C8A96B]/40 hover:bg-white/[0.04] hover:text-white",
                      filtrando && total === 0 && !activo && "opacity-40",
                    )}
                  >
                    <span className="min-w-0 break-words text-sm font-medium leading-snug">
                      {b}
                    </span>

                    <span
                      className={cn(
                        "shrink-0 text-xs tabular-nums",
                        activo ? "text-black/70" : "text-gray-400",
                      )}
                    >
                      {total}
                      {/* En el móvil sólo la cifra: la tira queda compacta (30/10/2026). */}
                      <span className="hidden lg:inline"> principio{total === 1 ? "" : "s"}</span>
                    </span>
                  </button>
                );
              })}

              {loading &&
                [0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 w-full animate-pulse rounded-2xl bg-white/[0.04]"
                  />
                ))}
            </nav>

            {/* 30/10/2026: el balón parado no está en la hoja del modelo; vive
                en la pizarra de ABP, y desde aquí se llega en un toque. */}
            {!loading && (
              <Link
                href="/abp-pizarra"
                className={cn(
                  "mt-3 flex items-center justify-between gap-3 rounded-xl border border-dashed border-white/15 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-[#C8A96B]/50 hover:text-white lg:rounded-2xl lg:px-4 lg:py-3",
                  focusRing,
                )}
              >
                <span>Balón parado</span>
                <span className="text-xs text-[#C8A96B]">Pizarra de ABP →</span>
              </Link>
            )}

            {/* Apartados */}
            {apartados.length > 1 && (
              <>
                <SectionLabel className="mt-6 mb-3 text-xs text-gray-400">Apartados</SectionLabel>

                <nav className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 scrollbar-none lg:block lg:space-y-2 lg:overflow-visible">
                  {apartados.map((a) => {
                    const total = visibles.filter(
                      (r) =>
                        r.FASE === fase &&
                        r.BLOQUE === bloque &&
                        r.APARTADO === a,
                    ).length;

                    const activo = apartado === a;

                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => seleccionarApartado(a)}
                        aria-current={activo ? "true" : undefined}
                        className={cn(
                          "flex w-auto min-w-[150px] max-w-[75%] shrink-0 snap-start items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-all lg:w-full lg:min-w-0 lg:max-w-none",
                          focusRing,
                          activo
                            ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                            : "border-white/10 text-gray-400 hover:border-white/25 hover:text-white",
                          filtrando && total === 0 && !activo && "opacity-40",
                        )}
                      >
                        <span className="truncate">{a}</span>

                        <span className="shrink-0 text-[11px] tabular-nums opacity-70">
                          {total}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </>
            )}
          </aside>

          {/* ---------------------------------------------- contenido */}

          {/* 30/10/2026: pb-24 para que el botón flotante de herramientas no
              tape la última tarjeta ni el botón de «Siguiente bloque». */}
          <main
            className={cn("min-w-0 flex-1 p-4 pb-24 lg:p-8 lg:pb-24", editing && "pb-32")}
          >
            {/* Cabecera */}
            <div className="flex flex-row items-start justify-between gap-4">
              <div className="min-w-0">
                {/* 30/10/2026: la miga «ATAQUE / GENERAL» repetía el titular
                    «ATAQUE · GENERAL». Sólo sale cuando el titular es un
                    apartado y hace falta saber de qué fase y bloque es. */}
                {titular !== apartado || !bloque ? null : (
                  <nav
                    aria-label="Ubicación"
                    className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.2em]"
                  >
                    {fase && <span className="text-[#C8A96B]">{fase}</span>}
                    <span aria-hidden className="text-gray-600">
                      /
                    </span>
                    <span className="text-gray-400">{bloque}</span>
                  </nav>
                )}

                <h1 className="break-words text-2xl font-semibold text-white sm:text-3xl lg:text-4xl">
                  {titular}
                </h1>

                {!loading && !error && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-500">
                    <span>
                      {filtrando
                        ? `${principios.length} de ${totalApartado} principios`
                        : `${totalApartado} principio${totalApartado === 1 ? "" : "s"}`}
                    </span>
                    {/* 07/11/2026: era texto dorado que no parecía enlace. */}
                    <Link
                      href="/identidad-campo"
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border border-[#C8A96B]/40 px-2.5 py-1 text-xs font-semibold text-[color:var(--rmcf-gold-ink,#C8A96B)] transition-colors hover:bg-[#C8A96B]/10",
                        focusRing,
                      )}
                    >
                      Ver en el campo →
                    </Link>
                  </div>
                )}
              </div>

              {!editing && !loading && !error && toolbar}
            </div>

            {/* Lista */}
            <div className="mt-6">
              {loading ? (
                <LoadingState label="Cargando principios…" />
              ) : error ? (
                <ErrorState message={error} onRetry={recargar} />
              ) : principios.length === 0 ? (
                filtrando ? (
                  <EmptyState
                    icon={<SearchX className="h-6 w-6" aria-hidden />}
                    title="Sin principios que coincidan"
                    hint={`Este apartado tiene ${totalApartado} principios, pero ninguno contiene «${query.trim()}». Los contadores del rail izquierdo indican dónde sí hay coincidencias.`}
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
                  <EmptyState
                    title="Este apartado aún no tiene principios"
                    hint="Añádelos desde la hoja de cálculo del modelo de juego."
                  />
                )
              ) : (
                <>
                {!editing &&
                  claves.length > 0 &&
                  claves.length < principios.length && (
                    /* 07/11/2026: una sola señal para lo innegociable. Sin la
                       frase de método (repetía las chapas): cada nombre salta
                       a su tarjeta. */
                    <div className="mb-4 border-l-2 border-[#C8A96B] pl-3">
                      <p className="text-base font-medium text-gray-200 lg:text-lg">
                        <Lock className="mr-1 inline h-4 w-4 -translate-y-px text-[color:var(--rmcf-gold-ink,#C8A96B)]" aria-hidden />
                        <span className="font-bold text-[color:var(--rmcf-gold-ink,#C8A96B)]">
                          Lo que no se negocia:
                        </span>{" "}
                        {claves.map((p, i) => (
                          <span key={p.ID}>
                            {i > 0 && " · "}
                            <a
                              href={`#principio-${p.ID}`}
                              className="underline decoration-[#C8A96B]/50 underline-offset-4 hover:decoration-[#C8A96B]"
                            >
                              {quitaClave(p.PRINCIPIO).replace(/[.\s]+$/, "")}
                            </a>
                          </span>
                        ))}
                      </p>
                      <BalanceInnegociables claves={claves} />
                    </div>
                  )}
                <ul className="space-y-3">
                  {principios.map((p) => (
                    <li
                      key={p.ID}
                      id={`principio-${p.ID}`}
                      className={cn(
                        "scroll-mt-24 rounded-2xl border bg-white/[0.03] transition-colors hover:border-[#C8A96B]/30 hover:bg-white/[0.05]",
                        /* 07/11/2026: la tarjeta de una sola línea va compacta
                           para que el apartado entero quepa en la primera pantalla. */
                        editing || tieneDetalle(p) || medidaDe(p)
                          ? "p-4 lg:p-5"
                          : "px-4 py-3 lg:px-5",
                        !editing && esClave(p.PRINCIPIO)
                          ? "border-[#C8A96B]/50"
                          : "border-white/10",
                      )}
                    >
                      <div className="flex min-w-0 items-start gap-3 lg:gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C8A96B] text-xs font-bold tabular-nums text-black lg:text-sm">
                          {p.ORDEN}
                        </div>

                        <div className="min-w-0 flex-1">
                          {editing ? (
                            <>
                              <AutoTextarea
                                value={p.PRINCIPIO}
                                aria-label={`Principio ${p.ORDEN} de ${apartado}`}
                                onChange={(e) =>
                                  setData((prev) =>
                                    prev.map((item) =>
                                      item.ID === p.ID
                                        ? { ...item, PRINCIPIO: e.target.value }
                                        : item,
                                    ),
                                  )
                                }
                              />
                              <AvisoLargo texto={p.PRINCIPIO} />
                            </>
                          ) : (
                            <>
                              {/* Además del color, un icono y una palabra (30/10/2026):
                                  el borde dorado solo no se distingue en modo día. */}
                              {esClave(p.PRINCIPIO) && (
                                <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--rmcf-gold-ink,#C8A96B)]">
                                  <Lock className="h-3 w-3" aria-hidden />
                                  Innegociable
                                </p>
                              )}
                              <FichaPrincipio p={p} query={query} />
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

            {/* Apartado anterior / siguiente. 30/10/2026: «Siguiente» es el
                botón principal y dice adónde lleva. */}
            {!loading && !error && ruta.length > 1 && (
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => saltar(-1)}
                  disabled={rutaIndex <= 0}
                  className={cn(
                    "inline-flex min-w-0 items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-left text-sm text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:invisible",
                    focusRing,
                  )}
                >
                  <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />

                  <span className="min-w-0">
                    <span className="block text-xs text-gray-400">
                      {ruta[rutaIndex - 1]?.bloque}
                    </span>
                    {!sinRotuloApartado(rutaIndex - 1) && (
                      <span className="block truncate">
                        {ruta[rutaIndex - 1]?.apartado}
                      </span>
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => saltar(1)}
                  disabled={rutaIndex < 0 || rutaIndex >= ruta.length - 1}
                  className={cn(
                    "inline-flex min-w-0 items-center gap-2 rounded-xl bg-[#C8A96B] px-4 py-2.5 text-right text-sm font-semibold text-black transition-colors hover:bg-[#d6ba80] disabled:invisible",
                    focusRing,
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-black/70">
                      {ruta[rutaIndex + 1]?.bloque === bloque
                        ? "Siguiente apartado"
                        : "Siguiente bloque"}
                    </span>
                    <span className="block break-words">
                      {ruta[rutaIndex + 1]?.bloque}
                    </span>
                    {!sinRotuloApartado(rutaIndex + 1) && (
                      <span className="block truncate text-xs font-medium text-black/70">
                        {ruta[rutaIndex + 1]?.apartado}
                      </span>
                    )}
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

/*
|--------------------------------------------------------------------------
| UN PRINCIPIO (30/10/2026)
|--------------------------------------------------------------------------
|
| Si la hoja trae definición, qué se ve, criterio o clip, el principio se
| despliega y enseña sólo eso. Sin nada de eso es una línea sin flecha: no se
| promete un desplegable vacío.
*/
/**
 * 07/11/2026: con qué se mide el principio en el partido (lib/identidad/campo.ts)
 * y el salto a su fila en /identidad-campo. Null si no tiene indicador.
 */
const medidaDe = (p: Principio) =>
  medidaDelPrincipio(p.FASE ?? "", p.BLOQUE ?? "", p.PRINCIPIO ?? "");

/*
| 08/11/2026: la cifra de cada principio medible (último partido, temporada y
| mediana de la categoría), del mismo cálculo que /identidad-campo. Se pide una
| vez para toda la pantalla; si la lectura falla, se enseña sólo con qué se
| mide; si llega y el principio no tiene dato, la línea no sale.
*/
type EstadoCifras = "cargando" | "error" | Map<string, CifraDelPrincipio[]>;

let promesaCifras: Promise<Map<string, CifraDelPrincipio[]>> | null = null;

const pideCifras = () =>
  (promesaCifras ??= traeJson<{ ok: boolean; partidos?: FilaPartido[] }>(
    "/api/data-analisis",
  ).then((r) => {
    if (!r.ok || !r.partidos) throw new Error("Sin partidos");
    return cifrasDelModelo(r.partidos);
  }));

function useCifras(): EstadoCifras {
  const [estado, setEstado] = useState<EstadoCifras>("cargando");

  useEffect(() => {
    let vivo = true;

    pideCifras().then(
      (m) => vivo && setEstado(m),
      () => {
        promesaCifras = null;
        if (vivo) setEstado("error");
      },
    );

    return () => {
      vivo = false;
    };
  }, []);

  return estado;
}

/** «Duelos ofensivos ganados %» → «% de duelos ofensivos ganados». */
const enEspanol = (nombre: string) => {
  const m = nombre.match(/^(.*?)\s*%\s*(\(.*\))?$/);

  return m ? `% de ${m[1].charAt(0).toLowerCase()}${m[1].slice(1)}${m[2] ? ` ${m[2]}` : ""}` : nombre;
};

/** El último partido queda del lado bueno de la mediana de la categoría. */
const cumple = (c: CifraDelPrincipio) =>
  c.mejorAlto ? c.ultimo.valor >= c.mediana : c.ultimo.valor <= c.mediana;

function CifraLinea({ c }: { c: CifraDelPrincipio }) {
  const bien = cumple(c);

  return (
    <li className="min-w-0">
      <span className="font-semibold text-white">{enEspanol(c.nombre)}</span>
      {": "}
      <span className="whitespace-nowrap">
        <span
          className={cn(
            "font-bold tabular-nums",
            bien ? "text-emerald-400" : "text-amber-400",
          )}
        >
          {bien ? "▲" : "▼"} {formatea(c.ultimo.valor, c.unidad)}
        </span>
        {c.ultimo.base && (
          <span className="tabular-nums text-gray-400">
            {" "}
            ({c.ultimo.base.de} de {c.ultimo.base.total})
          </span>
        )}
      </span>{" "}
      <span className="text-gray-400">
        en el último partido, ante {c.ultimo.rival}
        {" · "}
        <span className="whitespace-nowrap">
          temporada {formatea(c.temporada, c.unidad)} en {c.partidos} partidos
        </span>
        {" · "}
        <span className="whitespace-nowrap">
          mediana de {c.equipos} equipos {formatea(c.mediana, c.unidad)}
        </span>
        {!c.mejorAlto && " (menos es mejor)"}
      </span>
    </li>
  );
}

function MedidaPrincipio({ p }: { p: Principio }) {
  const m = medidaDe(p);
  const cifras = useCifras();

  if (!m || cifras === "cargando") return null;

  const suyas = cifras === "error" ? null : cifras.get(m.ancla);

  if (cifras !== "error" && !suyas?.length) return null;

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] leading-relaxed text-gray-300">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
        Se mide cada jornada · Wyscout
      </p>
      {suyas ? (
        <ul className="mt-1 space-y-1">
          {suyas.map((c) => (
            <CifraLinea key={c.nombre} c={c} />
          ))}
        </ul>
      ) : (
        <p className="mt-1">{m.metricas.map(enEspanol).join(" · ")}</p>
      )}
      <Link
        href={`/identidad-campo#${m.ancla}`}
        className="mt-1 inline-block font-semibold text-[color:var(--rmcf-gold-ink,#C8A96B)] hover:underline"
      >
        Ver partido a partido →
      </Link>
    </div>
  );
}

/** Cuántos innegociables medidos quedaron del lado bueno en el último partido. */
function BalanceInnegociables({ claves }: { claves: Principio[] }) {
  const cifras = useCifras();

  if (typeof cifras === "string") return null;

  const medidos = claves.flatMap((p) => {
    const m = medidaDe(p);
    const c = m ? cifras.get(m.ancla) : undefined;

    return c?.length ? [c] : [];
  });

  if (!medidos.length) return null;

  const cumplidos = medidos.filter((c) => c.every(cumple)).length;

  return (
    <p className="mt-1 text-sm text-gray-400">
      En el último partido,{" "}
      <span className="font-semibold text-white">
        {cumplidos} de {medidos.length}
      </span>{" "}
      {medidos.length === 1 ? "medido quedó" : "medidos quedaron"} del lado bueno
      de la mediana de la categoría.
    </p>
  );
}

function FichaPrincipio({ p, query }: { p: Principio; query: string }) {
  const titulo = (
    <Highlight text={quitaClave(p.PRINCIPIO).replace(/\.$/, "")} query={query} />
  );

  if (!tieneDetalle(p)) {
    return (
      <>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white lg:text-base">
          {titulo}
        </p>
        <MedidaPrincipio p={p} />
      </>
    );
  }

  const d = detalle(p);

  /* 07/11/2026: lo innegociable con texto se lee abierto, sin un clic más. */
  return (
    <>
    <details className="group" open={esClave(p.PRINCIPIO) || undefined}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm leading-relaxed text-white lg:text-base [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 break-words">{titulo}</span>
        <ChevronDown
          className="mt-0.5 h-4 w-4 shrink-0 text-[#C8A96B] transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <div className="mt-3 space-y-2 text-sm leading-relaxed text-gray-300">
        {d.definicion && <p className="whitespace-pre-wrap">{d.definicion}</p>}

        {d.queSeVe && (
          <p className="whitespace-pre-wrap">
            <span className="font-semibold text-white">Qué se ve: </span>
            {d.queSeVe}
          </p>
        )}

        {d.criterio && (
          <p className="whitespace-pre-wrap">
            <span className="font-semibold text-white">
              Criterio de éxito en la tarea:{" "}
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
    <MedidaPrincipio p={p} />
    </>
  );
}
