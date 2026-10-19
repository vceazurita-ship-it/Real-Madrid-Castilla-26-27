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
import { Loader2 } from "lucide-react";

const ORIGEN = "/api/rivals?action=alineaciones";

/**
 * Aviso de «la lista ha cambiado» (19/10/2026). La barra de la pizarra lo
 * lanza al guardar: antes la jornada recién guardada no aparecía aquí hasta
 * recargar la página, y parecía que no se había guardado.
 */
export const ALINEACIONES_CAMBIADAS = "rmcf:alineaciones-cambiadas";

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

/**
 * La fecha de la tarjeta. La hoja la devuelve como instante («…T22:00Z», que
 * es el día siguiente en Madrid y por eso se pinta en hora local), pero una
 * celda escrita como texto llega «19/10/2026», que `new Date` no entiende.
 * Una fecha que no se puede leer no se pinta: nada de «—» en la tarjeta.
 */
function formatDate(valor: string) {
  const texto = String(valor ?? "").trim();

  const dma = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  const dia = dma
    ? new Date(Number(dma[3]), Number(dma[2]) - 1, Number(dma[1]))
    : new Date(texto);

  return texto && !Number.isNaN(dia.getTime()) ? fecha.format(dia) : "";
}

export default function SavedLineups({ onLoad }: Props) {
  const [lineups, setLineups] = useState<SavedLineup[]>([]);

  /* Mientras llega la lista no se dice «no hay ninguna»: la primera lectura
     puede tardar un minuto y parecía que se habían borrado. */
  const [cargando, setCargando] = useState(true);

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
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    /* La lista llega de la hoja: el estado se escribe cuando vuelve el
       `fetch`, no durante el efecto. El analizador no distingue las dos
       cosas. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carga();

    const relee = () => void carga();

    window.addEventListener(ALINEACIONES_CAMBIADAS, relee);

    return () => window.removeEventListener(ALINEACIONES_CAMBIADAS, relee);
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
        cargando ? (
          <p className="flex items-center gap-2 text-xs text-white/40">
            <Loader2 size={13} className="animate-spin" />
            Cargando las jornadas guardadas…
          </p>
        ) : (
          <p className="text-xs text-white/40">
            Todavía no hay ninguna jornada guardada. Monta la alineación y
            pulsa «Guardar» con el nombre «Jornada» y su número.
          </p>
        )
      ) : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#C8A96B]/40">
          {visibleLineups.map((item) => {
            const dia = formatDate(item.Fecha);

            return (
              <button
                key={item.ID}
                type="button"
                onClick={() => onLoad(item.ID)}
                title={`Abrir la alineación de la ${item.Nombre}`}
                className="w-[220px] min-w-[220px] shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-[#C8A96B]"
              >
                <div className="font-semibold">{item.Nombre}</div>

                {dia && <div className="text-xs text-white/60">{dia}</div>}

                {item.Rival && (
                  <div className="text-xs text-[#C8A96B]">{item.Rival}</div>
                )}

                {item.Sistema && <div className="text-xs">{item.Sistema}</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
