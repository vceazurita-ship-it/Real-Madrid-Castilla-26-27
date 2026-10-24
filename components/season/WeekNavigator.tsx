"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  FileText,
  ImageIcon,
  Search,
  X,
} from "lucide-react";
import { MonthData, WeekData } from "@/lib/season/types";
import { weekFileCount, weekHasFiles } from "@/lib/season/utils";

type Filter = "all" | "with-files";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "with-files", label: "Con archivos" },
];

interface Props {
  season: MonthData[];
  selectedWeekId: number | null;
  currentWeekId: number | null;
  onSelectWeek: (week: WeekData) => void;
}

export default function WeekNavigator({
  season,
  selectedWeekId,
  currentWeekId,
  onSelectWeek,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [restoAbierto, setRestoAbierto] = useState(false);

  const selectedRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedMonthId = useMemo(
    () =>
      season.find((month) =>
        month.weeks.some((week) => week.id === selectedWeekId)
      )?.id ?? null,
    [season, selectedWeekId]
  );

  // Al cambiar de semana desde fuera (visor global, "semana actual"),
  // aseguramos que su mes esté abierto: se ajusta durante el render para
  // evitar un repintado en cascada.
  const [lastMonthId, setLastMonthId] = useState(selectedMonthId);

  if (selectedMonthId !== lastMonthId) {
    setLastMonthId(selectedMonthId);

    if (selectedMonthId !== null && collapsed[selectedMonthId]) {
      setCollapsed({ ...collapsed, [selectedMonthId]: false });
    }
  }

  useEffect(() => {
    /* Se desplaza sólo la lista: scrollIntoView movía también la ventana y la
       cabecera tapaba el título y los totales. 48 px = rótulo de mes fijo. */
    const cont = listRef.current;
    const el = selectedRef.current;
    if (!cont || !el) return;
    const cr = cont.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    if (er.top - cr.top < 48) cont.scrollTop += er.top - cr.top - 48;
    else if (er.bottom - cr.top > cont.clientHeight) cont.scrollTop += er.bottom - cr.top - cont.clientHeight;
  }, [selectedWeekId]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredMonths = useMemo(() => {
    return season
      .map((month) => ({
        ...month,
        weeks: month.weeks.filter((week) => {
          if (filter === "with-files" && !weekHasFiles(week)) return false;

          if (!normalizedQuery) return true;

          return [week.week, week.month, month.name, week.start, week.end]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        }),
      }))
      .filter((month) => month.weeks.length > 0);
  }, [season, filter, normalizedQuery]);

  const visibleWeeks = filteredMonths.reduce(
    (total, month) => total + month.weeks.length,
    0
  );

  const searching = normalizedQuery.length > 0 || filter !== "all";

  /* Posición del mes en curso dentro de la lista visible. */
  const posicionActual = filteredMonths.findIndex((month) =>
    month.weeks.some((week) => week.id === currentWeekId)
  );

  /* Meses futuros sin un solo archivo: una sola fila en vez de uno por mes. */
  const futurosEnGrupo = new Set(
    searching || posicionActual < 0
      ? []
      : filteredMonths
          .filter(
            (month, posicion) =>
              posicion > posicionActual &&
              month.id !== selectedMonthId &&
              month.weeks.every((week) => !weekHasFiles(week))
          )
          .map((month) => month.id)
  );

  const pintaMes = (month: MonthData, plegadoDeSalida: boolean) => {
    const isOpen = searching || !(collapsed[month.id] ?? plegadoDeSalida);

    const withFiles = month.weeks.filter(weekHasFiles).length;

    return (
      <section key={month.id}>
        <button
          type="button"
          onClick={() =>
            setCollapsed((state) => ({
              ...state,
              [month.id]: !(state[month.id] ?? plegadoDeSalida),
            }))
          }
          aria-expanded={isOpen}
          className="sticky top-0 z-10 flex w-full items-center gap-3 rounded-xl bg-[#11161D] px-3 py-2.5 text-left transition hover:bg-white/[0.04]"
        >
          <CalendarDays size={16} className="text-[#C8A96B]" />

          <span className="font-medium">{month.name}</span>

          <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs tabular-nums text-white/40">
            {withFiles}/{month.weeks.length}
          </span>

          <ChevronDown
            size={16}
            className={`ml-auto text-white/30 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="mt-1 space-y-1 pl-1">
            {month.weeks.map((week) => (
              <WeekRow
                key={week.id}
                rowRef={week.id === selectedWeekId ? selectedRef : undefined}
                week={week}
                selected={week.id === selectedWeekId}
                isCurrent={week.id === currentWeekId}
                onSelect={() => onSelectWeek(week)}
              />
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-[#11161D]">
      {/* BUSCADOR Y FILTROS */}

      <div className="space-y-3 border-b border-white/10 p-4">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
          />

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar semana o fecha..."
            aria-label="Buscar semana"
            className="w-full rounded-xl border border-white/10 bg-[#0B0F14] py-2.5 pl-10 pr-9 text-sm text-white placeholder:text-white/30 focus:border-[#C8A96B]/50 focus:outline-none"
          />

          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filter === item.id
                  ? "bg-[#C8A96B] text-[#0B0F14]"
                  : "border border-white/10 text-white/50 hover:border-white/20 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}

          <span className="ml-auto text-xs tabular-nums text-white/30">
            {visibleWeeks} semanas
          </span>
        </div>
      </div>

      {/* LISTA */}

      <div ref={listRef} className="max-h-[min(70vh,760px)] overflow-y-auto p-3 xl:max-h-[calc(100vh-260px)]">
        {filteredMonths.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-white/40">
            No hay semanas que coincidan con la búsqueda.
          </p>
        ) : (
          <div className="space-y-2">
            {filteredMonths.map((month, posicion) => {
              /* Al abrir sólo se despliegan el mes actual y el anterior (y el
                 de la semana elegida): el resto, plegado, y los meses futuros
                 vacíos van juntos en «Resto de la temporada». */
              if (futurosEnGrupo.has(month.id)) {
                if (futurosEnGrupo.values().next().value !== month.id) return null;

                const meses = filteredMonths.filter((m) => futurosEnGrupo.has(m.id));
                const semanas = meses.reduce((n, m) => n + m.weeks.length, 0);

                return (
                  <section key="resto">
                    <button
                      type="button"
                      onClick={() => setRestoAbierto((v) => !v)}
                      aria-expanded={restoAbierto}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.04]"
                    >
                      <CalendarDays size={16} className="text-white/30" />

                      <span className="font-medium text-white/60">
                        Resto de la temporada
                      </span>

                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs tabular-nums text-white/40">
                        {semanas} semanas
                      </span>

                      <ChevronDown
                        size={16}
                        className={`ml-auto text-white/30 transition-transform ${
                          restoAbierto ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {restoAbierto && (
                      <div className="mt-1 space-y-2 pl-1">
                        {meses.map((m) => pintaMes(m, true))}
                      </div>
                    )}
                  </section>
                );
              }

              return pintaMes(
                month,
                month.id !== selectedMonthId &&
                  posicion !== posicionActual &&
                  posicion !== posicionActual - 1,
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

}

function WeekRow({
  rowRef,
  week,
  selected,
  isCurrent,
  onSelect,
}: {
  rowRef?: React.Ref<HTMLButtonElement>;
  week: WeekData;
  selected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const { images, pdfs } = weekFileCount(week);

  const hasFiles = images + pdfs > 0;

  return (
    <button
      ref={rowRef}
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
        selected
          ? "border-[#C8A96B] bg-[#161D26]"
          : "border-transparent hover:border-white/10 hover:bg-white/[0.03]"
      }`}
    >
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          hasFiles ? "bg-emerald-400" : "bg-white/15"
        }`}
        aria-hidden
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{week.week}</span>

          {isCurrent && (
            <span className="shrink-0 rounded-full bg-[#C8A96B] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0B0F14]">
              Esta semana
            </span>
          )}
        </span>

        {week.start && week.end && (
          <span className="mt-0.5 block truncate text-xs text-white/40">
            {week.start} · {week.end}
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-2.5 text-xs tabular-nums text-white/40">
        {images > 0 && (
          <span className="flex items-center gap-1" title={`${images} imágenes`}>
            <ImageIcon size={13} className="text-[#C8A96B]" />
            {images}
          </span>
        )}

        {pdfs > 0 && (
          <span className="flex items-center gap-1" title={`${pdfs} PDFs`}>
            <FileText size={13} className="text-[#C8A96B]" />
            {pdfs}
          </span>
        )}

      </span>
    </button>
  );
}
