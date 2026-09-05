"use client";

/**
 * Las alineaciones guardadas de la pizarra de competición.
 *
 * Lee la hoja y enseña sólo las jornadas —"Jornada 7"—, que es como se busca
 * una alineación vieja: por partido, no por la prueba que alguien guardó un
 * martes.
 *
 * La lectura va por `/api/rivals`, que guarda la respuesta del Apps Script en
 * el servidor: en frío ese script tarda entre treinta y setenta segundos, y
 * esta lista se monta al abrir la pizarra. Guardar una alineación tira esa
 * copia (`lib/hojaRivales.ts`), así que la nueva aparece igual.
 */

import { useCallback, useEffect, useState } from "react";

const ORIGEN = "/api/rivals?action=alineaciones";

type SavedLineup = {
  ID: number;
  Nombre: string;
  Fecha: string;
  Rival: string;
  Sistema: string;
};

interface Props {
  onLoad: (id: number) => void;
}

const fecha = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Una fecha que la hoja trae en blanco o mal escrita no rompe la tarjeta. */
function formatDate(valor: string) {
  const dia = new Date(valor);

  return Number.isNaN(dia.getTime()) ? "—" : fecha.format(dia);
}

export default function SavedLineups({ onLoad }: Props) {
  const [lineups, setLineups] = useState<SavedLineup[]>([]);

  /*
  | Declarada ANTES del efecto que la usa. Estaba después: funcionaba por el
  | izado de las funciones, pero el compilador de React lo da por error —una
  | lectura antes de la declaración no se entera de los cambios— y ninguna
  | herramienta del proyecto pasaba limpia.
  */
  const carga = useCallback(async () => {
    try {
      const res = await fetch(ORIGEN);

      const data = await res.json();

      /*
      | La hoja contesta 200 con un objeto de error cuando algo va mal. Sin
      | esta comprobación, `lineups.filter` reventaba la pizarra entera.
      */
      setLineups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("[pizarra] alineaciones guardadas", error);

      setLineups([]);
    }
  }, []);

  useEffect(() => {
    /* La lista llega de la hoja: el estado se escribe cuando vuelve el
       `fetch`, no durante el efecto. El analizador no distingue las dos
       cosas. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carga();
  }, [carga]);

  /* Sólo las jornadas; y un nombre vacío en la hoja ya no tira la página. */
  const visibleLineups = lineups.filter((item) =>
    /^Jornada\s+\d+$/i.test(String(item?.Nombre ?? "").trim()),
  );

  return (
    <div className="rounded-2xl border border-[#C8A96B]/20 bg-[#10161D] p-4">
      <h3 className="mb-4 text-sm font-semibold text-[#C8A96B]">
        Alineaciones guardadas
      </h3>

      {visibleLineups.length === 0 ? (
        <p className="text-xs text-white/40">
          Todavía no hay ninguna jornada guardada.
        </p>
      ) : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#C8A96B]/40">
          {visibleLineups.map((item) => (
            <button
              key={item.ID}
              type="button"
              onClick={() => onLoad(item.ID)}
              className="w-[220px] min-w-[220px] shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-[#C8A96B]"
            >
              <div className="font-semibold">{item.Nombre}</div>

              <div className="text-xs text-white/60">
                {formatDate(item.Fecha)}
              </div>

              <div className="text-xs text-[#C8A96B]">{item.Rival}</div>

              <div className="text-xs">{item.Sistema}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
