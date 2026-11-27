"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AlertTriangle, ChevronDown, ExternalLink, FileText, ImageIcon, LineChart, ListFilter, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { loadSeasonData, saveWeekChange, uploadSeasonFile } from "@/lib/season/api";
import { AREA_CONFIG } from "@/lib/season/config";
import {
  aplicaCambio,
  CambioSemana,
  inverso,
  poneSemana,
} from "@/lib/season/fusion";
import { FileKind, MonthData, SeasonArea, WeekData } from "@/lib/season/types";
import {
  collectFiles,
  findWeekForDate,
  flattenWeeks,
  humanFileName,
  seasonStats,
  weekHasFiles,
  weekRangeLabel,
} from "@/lib/season/utils";
import SeasonFilesViewer from "./SeasonFilesViewer";
import SeasonHeader from "./SeasonHeader";
import WeekNavigator from "./WeekNavigator";
import WeekPanel from "./WeekPanel";
import { useCalendario } from "@/hooks/useCalendario";
import { partidoDeLaSemana, rotuloPartido } from "@/lib/season/partido-semana";
import { enlacesDelRival, useJornadasRivales } from "@/components/rivals/EnlacesDelRival";
import { proximoPartido, type PartidoNuestro } from "@/lib/castilla/calendario";
import { urlPostDelPartido } from "@/lib/post-partido";

interface Props {
  area: SeasonArea;
}

const MiniaturaArchivo = dynamic(() => import("./MiniaturaArchivo"), { ssr: false });

export default function SeasonWorkspace({ area }: Props) {
  const [season, setSeason] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Un contador y no un sí/no: con una subida y un borrado a la vez, el primero
  // en terminar apagaba «Guardando» mientras el otro seguía en camino.
  const [savingCount, setSavingCount] = useState(0);
  const saving = savingCount > 0;
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [filesViewer, setFilesViewer] = useState<FileKind | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  /* 20/11/2026 (ronda 5): «Otras semanas» enseña las 3 últimas; el resto, a un toque. */
  const [todasOtras, setTodasOtras] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  const fetchSeason = useCallback(
    async (options: { keepSelection?: boolean } = {}) => {
      try {
        const data = await loadSeasonData(area);

        setSeason(data);
        setLoadError(false);

        if (!options.keepSelection) {
          const weeks = flattenWeeks(data);
          const current = findWeekForDate(data) ?? weeks[0] ?? null;

          /* Se abre la semana en curso aunque esté vacía (21/10/2026): abrir
             otra distinta escondía que a esta le falta el material. La cabecera
             dice qué subir y el panel ofrece la última semana con archivos. */
          setSelectedWeekId(current?.id ?? null);
        }
      } catch (error) {
        console.error(error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    },
    [area]
  );

  /** Recarga manual: muestra el esqueleto mientras llegan los datos. */
  const reloadSeason = useCallback(
    (options: { keepSelection?: boolean } = {}) => {
      setLoading(true);
      void fetchSeason(options);
    },
    [fetchSeason]
  );

  useEffect(() => {
    // Los `setState` de `fetchSeason` ocurren tras el `await`, nunca de forma
    // síncrona dentro del efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSeason();
  }, [fetchSeason]);

  const currentWeek = useMemo(() => findWeekForDate(season), [season]);

  const selectedWeek = useMemo(
    () =>
      selectedWeekId === null
        ? null
        : flattenWeeks(season).find((week) => week.id === selectedWeekId) ??
          null,
    [season, selectedWeekId]
  );

  // Para el hueco vacío de una semana sin archivos: la más cercana anterior
  // que sí los tiene.
  const ultimaConArchivos = useMemo(() => {
    if (!selectedWeek) return null;

    const previas = flattenWeeks(season)
      .filter((week) => week.id < selectedWeek.id && weekHasFiles(week))
      .sort((a, b) => b.id - a.id);

    return previas[0] ?? null;
  }, [season, selectedWeek]);

  // Para la cabecera de la semana en curso: la última anterior con material.
  const ultimaConMaterial = useMemo(() => {
    if (!currentWeek) return null;

    return (
      flattenWeeks(season)
        .filter((week) => week.id < currentWeek.id && weekHasFiles(week))
        .sort((a, b) => b.id - a.id)[0] ?? null
    );
  }, [season, currentWeek]);

  const semanasCon = useMemo(() => {
    const semanas = flattenWeeks(season);

    return {
      images: semanas.filter((week) => (week.images?.length ?? 0) > 0).length,
      pdfs: semanas.filter((week) => (week.pdfs?.length ?? 0) > 0).length,
    };
  }, [season]);

  /* 17/11/2026 (fútbol): el calendario de BeSoccer, para decir el partido de cada semana. */
  const { partidos: calendario } = useCalendario();

  // Una casilla por semana ya transcurrida: con material o sin él.
  const tiraSemanas = useMemo(() => {
    if (!currentWeek) return [];

    return flattenWeeks(season)
      .filter((week) => week.id <= currentWeek.id)
      .map((week) => {
        const partido = partidoDeLaSemana(calendario, week);

        return {
          id: week.id,
          nombre: week.week,
          conMaterial: weekHasFiles(week),
          actual: week.id === currentWeek.id,
          fechas: week.start || week.end ? weekRangeLabel(week) : undefined,
          partido: partido ? rotuloPartido(partido) : undefined,
          partidoDatos: partido,
          imagenes: week.images?.length ?? 0,
          pdfs: week.pdfs?.length ?? 0,
          /* 20/11/2026 (ronda 5, fútbol y marketing): el último archivo de la semana, con enlace directo. */
          ultimo: ultimoArchivo(week.images ?? [], week.pdfs ?? []),
          /* 20/11/2026 (ronda 7, análisis): convocatoria, horario y, si hubo partido, plan. */
          completa: semanaCompleta(week, Boolean(partido)),
          /* 27/11/2026 (jueces, ronda 9): la tira colorea las semanas con partido y marca las que, ya jugado, no tienen sus tres cosas. */
          conPartido: Boolean(partido),
          faltaAlgo: Boolean(partido?.jugado) && week.id !== currentWeek.id && !semanaCompleta(week, true),
          /* 27/11/2026 (análisis, ronda 11): qué le falta a cada semana con partido, para listarlas con su semana. */
          faltan: partido
            ? [
                semanaTiene(week, /convoca/) ? "" : "convocatoria",
                semanaTiene(week, /horario/) ? "" : "horario",
                semanaTiene(week, /plan/) ? "" : "plan",
              ].filter(Boolean)
            : [],
        };
      });
  }, [season, currentWeek, calendario]);

  /* 20/11/2026 (ronda 4, los tres jueces): las semanas que sí tienen material,
     de la más reciente a la más antigua, para «Otras semanas». */
  const semanasConMaterial = useMemo(
    () => [...tiraSemanas].filter((s) => s.conMaterial).reverse(),
    [tiraSemanas]
  );

  /*
  | LO QUE DEBERÍA HABER CADA SEMANA (20/11/2026, ronda 5, análisis y
  | marketing): «sin subidas desde la semana 9» era un reproche. Ahora la
  | cabecera dice qué falta esta semana —convocatoria, horario y, si hay
  | partido, el plan— leyendo el nombre de los archivos subidos, y lleva al
  | Plan de partido y al ABP del rival con el rival ya elegido.
  */
  const jornadasRivales = useJornadasRivales();
  /*
  | EL PARTIDO «DE ESTA SEMANA» ES EL PRÓXIMO (21/11/2026, jueces): la semana
  | sigue siendo la del calendario (lunes a domingo), pero el sábado tras la
  | J13 (vie 20/11) la cabecera decía «J13 vs Real Murcia · 0-2» y «AHORA ·
  | J13» cuando ya tocaba la J14. Si el de la semana ya se jugó, se nombra el
  | próximo por la regla de la portada (`proximoPartido`: hora de Madrid y
  | 2,5 h de gracia). El reloj, en un efecto: nada de `Date.now()` al pintar.
  */
  const [ahora, setAhora] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setAhora(Date.now()), 0);
    return () => clearTimeout(id);
  }, []);
  const partidoActual = useMemo(() => {
    if (!ahora) return null;
    const deLaSemana = partidoDeLaSemana(calendario, currentWeek);
    if (!deLaSemana) return null;
    const proximo = proximoPartido(calendario, ahora);
    return proximo && deLaSemana.cuando < proximo.cuando ? proximo : deLaSemana;
  }, [calendario, currentWeek, ahora]);
  const enlacesActual = useMemo(
    () => (partidoActual && !partidoActual.jugado ? enlacesDelRival(jornadasRivales, partidoActual.rival, partidoActual.cuando) : []),
    [jornadasRivales, partidoActual]
  );
  const checklist = useMemo(() => {
    if (area !== "general" || !currentWeek) return undefined;

    const plan = enlacesActual.find((e) => e.texto === "Plan de partido")?.href;

    return [
      { texto: "Convocatoria", hecho: semanaTiene(currentWeek, /convoca/) },
      { texto: "Horario", hecho: semanaTiene(currentWeek, /horario/) },
      ...(partidoActual ? [{ texto: "Plan de partido", hecho: semanaTiene(currentWeek, /plan/), href: plan }] : []),
    ];
  }, [area, currentWeek, enlacesActual, partidoActual]);

  /*
  | 20/11/2026 (ronda 7, fútbol): los accesos de la semana, en un solo sitio
  | —la tarjeta de la semana en curso, arriba—. El Plan de partido va en su
  | casilla de la lista; aquí el microciclo, la plantilla y el ABP del rival.
  */
  const enlacesRival = useMemo(
    () => [
      { href: "/microcycles", texto: "Contenidos del microciclo" },
      ...enlacesActual
        .filter((e) => e.texto === "Su plantilla" || e.texto === "Su ABP")
        .map((e) => ({ href: e.href, texto: e.texto === "Su ABP" ? `ABP de ${e.equipo}` : `Plantilla de ${e.equipo}` })),
      /* 27/11/2026 (marketing, ronda 11): la convocatoria y el horario del viaje se preparan en Desplazamiento. */
      ...(area === "general" && partidoActual && !partidoActual.jugado ? [{ href: "/desplazamiento", texto: "Desplazamiento" }] : []),
    ],
    [enlacesActual, area, partidoActual]
  );

  /* 20/11/2026 (ronda 7, análisis): cuántas semanas tienen todo lo de cada semana. */
  const cumplimiento = useMemo(() => {
    if (area !== "general" || tiraSemanas.length < 2) return undefined;
    /*
    | 27/11/2026 (jueces, ronda 9): «1 de 22» contaba todas las semanas, con
    | pretemporada y semanas sin partido, aunque la nota decía que el plan sólo
    | cuenta con partido. La base son ahora las semanas con partido ya jugado
    | (la de ahora va en su tarjeta), la misma en la cifra y en la barra.
    */
    const conPartido = tiraSemanas.filter((s) => s.partidoDatos?.jugado && !s.actual);
    if (!conPartido.length) return undefined;
    const completas = conPartido.filter((s) => s.completa);
    return {
      completas: completas.length,
      total: conPartido.length,
      ultima: completas[completas.length - 1]?.nombre,
      /* 27/11/2026 (análisis y fútbol, ronda 11): cada partido jugado, en orden, con lo que le falta. */
      partidos: conPartido.map((s) => ({ id: s.id, nombre: s.nombre, partido: s.partido, faltan: s.faltan })),
    };
  }, [area, tiraSemanas]);

  const partidoSemanaAbierta = useMemo(
    () => partidoDeLaSemana(calendario, selectedWeek),
    [calendario, selectedWeek]
  );

  const stats = useMemo(
    () => seasonStats(season, currentWeek?.id ?? null),
    [season, currentWeek]
  );

  const allImages = useMemo(() => collectFiles(season, "images"), [season]);
  const allPdfs = useMemo(() => collectFiles(season, "pdfs"), [season]);

  const selectWeek = useCallback(
    (weekId: number, options: { scroll?: boolean } = {}) => {
      setSelectedWeekId(weekId);
      setNavOpen(false);

      if (options.scroll !== false) {
        // Esperamos al render del panel antes de desplazarnos.
        requestAnimationFrame(() => {
          if (window.matchMedia("(min-width: 1280px)").matches) return;

          panelRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      }
    },
    []
  );

  /*
  | Guarda UN cambio de semana de forma optimista (19/10/2026).
  |
  | Antes se mandaba la temporada entera tal como la veía esta pestaña, y se
  | revertía a una foto completa si fallaba: con dos personas a la vez la
  | segunda borraba lo de la primera, y una reversión se llevaba también
  | cualquier otro cambio hecho mientras tanto. Ahora viaja sólo el cambio, el
  | servidor lo aplica sobre lo último guardado y devuelve cómo ha quedado la
  | semana (con lo que otros hayan subido); si falla, se deshace sólo ese
  | cambio. Todo con actualizaciones funcionales: dos subidas seguidas no se
  | pisan por leer `season` de un render anterior.
  */
  const updateWeek = useCallback(
    async (cambio: CambioSemana) => {
      const aplica = (meses: MonthData[], c: CambioSemana) =>
        (aplicaCambio(meses, c)?.raw as MonthData[] | undefined) ?? meses;

      setSeason((meses) => aplica(meses, cambio));
      setSavingCount((n) => n + 1);

      try {
        const semana = await saveWeekChange(area, cambio);

        setSeason((meses) => poneSemana(meses, semana));
      } catch (error) {
        console.error(error);
        setSeason((meses) => aplica(meses, inverso(cambio)));

        toast.error("No se ha podido guardar y se ha deshecho el cambio.", {
          description:
            error instanceof Error && error.message ? error.message : undefined,
        });

        throw error;
      } finally {
        setSavingCount((n) => n - 1);
      }
    },
    [area]
  );

  /*
  | SUBIR DESDE LA LISTA DE LA SEMANA (20/11/2026, ronda 7, los tres jueces):
  | cada casilla —convocatoria, horario, plan— abre su propia subida a la
  | semana en curso. Si el nombre del archivo no dice qué es, se le antepone
  | («Convocatoria-…»), para que la casilla quede marcada al subirlo.
  */
  const [subiendo, setSubiendo] = useState(false);
  const subirALaSemana = useCallback(
    async (tipo: string | null, archivos: File[]) => {
      if (!currentWeek || archivos.length === 0) return;
      const validos = archivos
        .filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type) || f.type === "application/pdf")
        .slice(0, 20);
      if (validos.length < archivos.length) toast.error("Algunos archivos no se han subido: sólo JPG, PNG, WEBP o PDF, hasta 20.");
      if (validos.length === 0) return;

      const marca = tipo ? (TIPO_EN_NOMBRE[tipo] ?? null) : null;
      const renombra = (f: File) =>
        marca && !marca.re.test(f.name.toLowerCase()) ? new File([f], `${marca.prefijo}-${f.name}`, { type: f.type }) : f;
      const carpeta = (kind: "images" | "pdf") =>
        `${AREA_CONFIG[area].storagePrefix}/semana-${currentWeek.id.toString().padStart(2, "0")}/${kind}`;
      const cuantos = (n: number) => (n === 1 ? "1 archivo" : `${n} archivos`);

      setSubiendo(true);
      const aviso = toast.loading(`Subiendo ${cuantos(validos.length)} a la ${currentWeek.week.toLowerCase()}...`);
      try {
        const sube = async (lista: File[], kind: "images" | "pdf") => {
          const r = await Promise.allSettled(lista.map((f) => uploadSeasonFile(area, renombra(f), carpeta(kind))));
          return r.filter((x): x is PromiseFulfilledResult<string> => x.status === "fulfilled").map((x) => x.value);
        };
        const imagenes = await sube(validos.filter((f) => f.type.startsWith("image/")), "images");
        const pdfs = await sube(validos.filter((f) => f.type === "application/pdf"), "pdf");
        const subidos = imagenes.length + pdfs.length;
        if (subidos === 0) {
          toast.error("No se pudo subir ningún archivo.", { id: aviso });
          return;
        }
        try {
          await updateWeek({
            weekId: currentWeek.id,
            anade: { ...(imagenes.length ? { images: imagenes } : {}), ...(pdfs.length ? { pdfs } : {}) },
          });
        } catch {
          toast.dismiss(aviso);
          return;
        }
        const fallidos = validos.length - subidos;
        if (fallidos) toast.warning(`${subidos} subidos · ${fallidos} con error.`, { id: aviso });
        else toast.success(`${cuantos(subidos)} en la ${currentWeek.week.toLowerCase()}`, { id: aviso });
      } catch (error) {
        console.error(error);
        toast.error("Error subiendo los archivos.", { id: aviso });
      } finally {
        setSubiendo(false);
      }
    },
    [area, currentWeek, updateWeek]
  );

  /* En el repositorio general, la semana en curso vacía ya es la tarjeta de arriba: no se repite abajo. */
  const panelDuplicado =
    area === "general" && !!selectedWeek && selectedWeek.id === currentWeek?.id && !weekHasFiles(selectedWeek);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="min-w-0 flex-1">
          <Topbar />

          {/* Margen a la derecha para el botón flotante de herramientas (30/10/2026):
              tapaba la esquina de «PDFs de la temporada» y de «Lo último subido». */}
          <div className="py-8 pl-5 pr-12 sm:pl-6 sm:pr-[76px] lg:pl-10">

            {loading ? (
              <LoadingState />
            ) : loadError ? (
              <ErrorState onRetry={() => reloadSeason()} />
            ) : (
              <>
                <SeasonHeader
                  area={area}
                  stats={stats}
                  currentWeek={currentWeek}
                  ultimaConMaterial={ultimaConMaterial}
                  semanasCon={semanasCon}
                  tiraSemanas={tiraSemanas}
                  checklist={checklist}
                  cumplimiento={cumplimiento}
                  onSubirTipo={area === "general" ? subirALaSemana : undefined}
                  subiendo={subiendo}
                  partidoActual={partidoActual ? rotuloPartido(partidoActual) : undefined}
                  enlacesRival={enlacesRival}
                  onSelectWeek={(id) => selectWeek(id)}
                  saving={saving}
                  onGoToCurrentWeek={() => {
                    if (!currentWeek) return;

                    /*
                    | «Subir a la semana 18» lleva a la zona de subida y deja
                    | el foco en «Seleccionar archivos» (30/10/2026): antes
                    | sólo elegía la semana y había tres maneras de subir sin
                    | que ninguna llevara a las otras.
                    */
                    if (!weekHasFiles(currentWeek)) {
                      selectWeek(currentWeek.id, { scroll: false });

                      setTimeout(() => {
                        const zona = document.getElementById("zona-subida");

                        zona?.scrollIntoView({ behavior: "smooth", block: "center" });
                        zona?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
                      }, 60);

                      return;
                    }

                    selectWeek(currentWeek.id);
                  }}
                  onOpenImages={() => setFilesViewer("images")}
                  onOpenPdfs={() => setFilesViewer("pdfs")}
                  onReload={() => reloadSeason({ keepSelection: true })}
                />

                {/*
                | LA LISTA DE SEMANAS, PLEGADA (10/11/2026, análisis y marketing):
                | la tira de arriba ya lleva a cada semana pasada y la semana
                | abierta va al lado; la lista por meses repetía lo mismo. Se
                | despliega para buscar una semana futura o por fecha.
                */}

                {/*
                | LO ÚLTIMO SUBIDO, A LA VISTA (20/11/2026, ronda 4, fútbol y
                | marketing): la pantalla abría con una fila de números; ahora
                | lo primero es el material —las últimas imágenes en miniatura y
                | los últimos PDF con su nombre—, y cada uno abre su semana.
                */}
                {/*
                | 20/11/2026 (ronda 5, los tres jueces): fuera «Lo último
                | subido»; enseñaba el mismo material que «Otras semanas»,
                | una debajo de la otra. Queda una sola vista: las tres
                | semanas más recientes con material, cada una con su último
                | archivo (enlace directo) y su partido; el resto, a un toque.
                */}
                <div className="mb-4 rounded-2xl border border-white/10 bg-[#11161D] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* 20/11/2026 (ronda 7, marketing): el archivo, en segundo plano, debajo de la semana en curso. */}
                    <span className={`min-w-0 font-medium ${area === "general" ? "text-[12.5px] uppercase tracking-[0.12em] text-white/65" : "text-sm text-white/75"}`}>
                      {area === "general" ? "Archivo · últimas semanas con material" : "Últimas semanas con material"}
                    </span>

                    <button
                      type="button"
                      onClick={() => setNavOpen((value) => !value)}
                      aria-expanded={navOpen}
                      className="inline-flex min-h-9 shrink-0 items-center gap-2 text-sm text-[#C8A96B]"
                    >
                      <ListFilter size={16} />
                      {navOpen ? "Ocultar la lista" : area === "general" ? "Ver todo el archivo" : "Todas, por meses"}
                    </button>
                  </div>

                  {semanasConMaterial.length > 0 ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {(todasOtras ? semanasConMaterial : semanasConMaterial.slice(0, 3)).map((s) => (
                        <TarjetaSemana
                          key={s.id}
                          semana={s}
                          elegida={s.id === selectedWeekId}
                          miniatura={area === "general"}
                          onSelect={() => selectWeek(s.id)}
                        />
                      ))}
                    </div>
                  ) : null}

                  {semanasConMaterial.length > 3 ? (
                    <button
                      type="button"
                      onClick={() => setTodasOtras((v) => !v)}
                      aria-expanded={todasOtras}
                      className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-[13px] font-medium text-[#C8A96B]"
                    >
                      <ChevronDown size={15} className={todasOtras ? "rotate-180" : ""} aria-hidden />
                      {todasOtras
                        ? "Ver sólo las 3 últimas"
                        : `Ver las otras ${semanasConMaterial.length - 3} con material`}
                    </button>
                  ) : null}
                </div>

                <div className={`grid items-start gap-6 ${navOpen ? "xl:grid-cols-[380px_1fr]" : ""}`}>
                  <div
                    className={`${
                      navOpen ? "block" : "hidden"
                    } xl:sticky xl:top-6`}
                  >
                    <WeekNavigator
                      season={season}
                      selectedWeekId={selectedWeekId}
                      currentWeekId={currentWeek?.id ?? null}
                      onSelectWeek={(week) => selectWeek(week.id)}
                    />
                  </div>

                  <div ref={panelRef} className={`scroll-mt-6 min-w-0 ${panelDuplicado ? "hidden" : ""}`}>
                    <WeekPanel
                      area={area}
                      week={selectedWeek}
                      isCurrentWeek={
                        selectedWeek !== null &&
                        selectedWeek.id === currentWeek?.id
                      }
                      ultimaConArchivos={ultimaConArchivos}
                      partido={partidoSemanaAbierta}
                      sinAccesos={area === "general" && selectedWeek?.id === currentWeek?.id}
                      onSelectWeek={selectWeek}
                      onUpdateWeek={updateWeek}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {filesViewer && (
        <SeasonFilesViewer
          kind={filesViewer}
          files={filesViewer === "images" ? allImages : allPdfs}
          onClose={() => setFilesViewer(null)}
          onSelectWeek={(weekId) => selectWeek(weekId)}
        />
      )}
    </main>
  );
}

const TIPO_EN_NOMBRE: Record<string, { re: RegExp; prefijo: string }> = {
  Convocatoria: { re: /convoca/, prefijo: "Convocatoria" },
  Horario: { re: /horario/, prefijo: "Horario" },
  "Plan de partido": { re: /plan/, prefijo: "Plan-de-partido" },
};

/** Si algún archivo de la semana se llama de esa manera (convocatoria, horario, plan). */
function semanaTiene(week: WeekData, re: RegExp) {
  return [...(week.images ?? []), ...(week.pdfs ?? [])].some((url) => re.test(humanFileName(url, "").toLowerCase()));
}

/** Semana completa: convocatoria, horario y, si tuvo partido, plan de partido. */
function semanaCompleta(week: WeekData, conPartido: boolean) {
  return semanaTiene(week, /convoca/) && semanaTiene(week, /horario/) && (!conPartido || semanaTiene(week, /plan/));
}

/** La etiqueta de un archivo por su nombre (la misma regla que la lista de la semana). */
function tipoDeArchivo(nombre: string) {
  const n = nombre.toLowerCase();
  if (/convoca/.test(n)) return "Convocatoria";
  if (/horario/.test(n)) return "Horario";
  if (/plan/.test(n)) return "Plan de partido";
  if (/multa/.test(n)) return "Multas";
  if (/firma/.test(n)) return "Firmas";
  return null;
}

/** El último archivo de una semana: el último PDF si lo hay; si no, la última imagen. */
function ultimoArchivo(imagenes: string[], pdfs: string[]) {
  if (pdfs.length) return { url: pdfs[pdfs.length - 1], kind: "pdfs" as FileKind };
  if (imagenes.length) return { url: imagenes[imagenes.length - 1], kind: "images" as FileKind };
  return undefined;
}

type SemanaTira = {
  id: number;
  nombre: string;
  fechas?: string;
  partido?: string;
  partidoDatos?: PartidoNuestro | null;
  imagenes?: number;
  pdfs?: number;
  ultimo?: { url: string; kind: FileKind };
  completa?: boolean;
};

/**
 * Una semana con material (20/11/2026, ronda 5): abre la semana, enseña su
 * último archivo con enlace directo y, si su partido ya se jugó, su análisis.
 */
function TarjetaSemana({
  semana: s,
  elegida,
  miniatura = false,
  onSelect,
}: {
  semana: SemanaTira;
  elegida: boolean;
  /** La primera página o la imagen en pequeño (sólo el repositorio general). */
  miniatura?: boolean;
  onSelect: () => void;
}) {
  const nombreUltimo = s.ultimo ? humanFileName(s.ultimo.url, s.ultimo.kind === "images" ? "Imagen" : "Documento") : "";
  /* 27/11/2026 (análisis y marketing, ronda 9): qué es cada archivo, dicho con una etiqueta, no sólo con su nombre crudo. */
  const tipo = miniatura && nombreUltimo ? tipoDeArchivo(nombreUltimo) : null;

  return (
    <div
      className={`min-w-0 rounded-xl border px-3 py-2 transition ${
        elegida ? "border-[#C8A96B]/70 bg-[#C8A96B]/[0.08]" : "border-white/10"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={elegida ? "true" : undefined}
        className="block w-full min-w-0 text-left hover:text-[#C8A96B]"
      >
        <span className="block text-[13.5px] font-semibold text-white/90">
          {s.nombre}
          {s.fechas ? <span className="font-normal text-white/60"> · {s.fechas}</span> : null}
        </span>
        <span className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-white/70">
          {s.imagenes ? (
            <span className="inline-flex items-center gap-1">
              <ImageIcon size={12} className="text-[#C8A96B]" aria-hidden />
              {s.imagenes === 1 ? "1 imagen" : `${s.imagenes} imágenes`}
            </span>
          ) : null}
          {s.pdfs ? (
            <span className="inline-flex items-center gap-1">
              <FileText size={12} className="text-[#C8A96B]" aria-hidden />
              {`${s.pdfs} PDF`}
            </span>
          ) : null}
        </span>
      </button>

      {s.ultimo ? (
        <a
          href={s.ultimo.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Abrir ${nombreUltimo}`}
          className="mt-1.5 flex min-h-8 min-w-0 items-center gap-1.5 text-[12.5px] text-white/80 underline decoration-white/25 underline-offset-2 hover:text-[#C8A96B] hover:decoration-[#C8A96B]"
        >
          {miniatura ? (
            <MiniaturaArchivo url={s.ultimo.url} kind={s.ultimo.kind} />
          ) : s.ultimo.kind === "images" ? (
            <ImageIcon size={13} className="shrink-0 text-[#C8A96B]" aria-hidden />
          ) : (
            <FileText size={13} className="shrink-0 text-[#C8A96B]" aria-hidden />
          )}
          {tipo ? (
            <span className="shrink-0 rounded border border-[#C8A96B]/45 px-1.5 py-0.5 text-[11px] font-semibold no-underline" style={{ color: "var(--rmcf-gold-ink)" }}>
              {tipo}
            </span>
          ) : null}
          {/* 27/11/2026 (fútbol, ronda 11): en el repositorio general el nombre va en dos líneas, sin cortarse en 390 px. */}
          <span className={miniatura ? "line-clamp-2 min-w-0 break-all" : "truncate"}>{nombreUltimo}</span>
          <ExternalLink size={12} className="shrink-0 opacity-70" aria-hidden />
        </a>
      ) : null}

      {s.partidoDatos ? (
        s.partidoDatos.jugado ? (
          <Link
            href={urlPostDelPartido(s.partidoDatos.cuando, s.partidoDatos.rival)}
            className="mt-1 flex min-h-8 min-w-0 items-center gap-1.5 text-[12.5px] text-white/75 hover:text-[#C8A96B]"
          >
            <LineChart size={13} className="shrink-0 text-[#C8A96B]" aria-hidden />
            <span className="truncate">{`${s.partido} · su análisis`}</span>
          </Link>
        ) : (
          <span className="mt-1 block truncate text-[12px] text-white/70">{s.partido}</span>
        )
      ) : null}
    </div>
  );
}

function LoadingState() {
  return (
    <div>
      <div className="h-8 w-64 animate-pulse rounded-xl bg-white/5" />

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl border border-white/10 bg-[#11161D]"
          />
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="h-[420px] animate-pulse rounded-3xl border border-white/10 bg-[#11161D]" />
        <div className="h-[420px] animate-pulse rounded-3xl border border-white/10 bg-[#11161D]" />
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-sm text-white/40">
        <Loader2 size={15} className="animate-spin" />
        Cargando temporada...
      </p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-white/10 bg-[#11161D] px-6 py-20 text-center">
      <AlertTriangle size={40} className="text-red-400" />

      <h2 className="mt-5 text-xl font-semibold">
        No se pudo cargar la temporada
      </h2>

      <p className="mt-2 max-w-sm text-sm leading-6 text-white/50">
        Revisa la conexión e inténtalo de nuevo. Si el problema continúa, avisa
        al equipo técnico.
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="mt-6 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-5 py-2.5 text-sm font-medium text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
      >
        Reintentar
      </button>
    </div>
  );
}
