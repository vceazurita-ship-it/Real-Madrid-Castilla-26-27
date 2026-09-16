"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EllipsisVertical, X } from "lucide-react";

/**
 * Para que una fila pueda cerrar el menú al elegirla.
 *
 * Cerrarlo desde el contenedor —un `onClick` en la caja— parecía más simple y
 * estaba mal: desmontaba las filas, y con ellas el estado de la herramienta
 * que se acababa de pulsar. El panel de exportar se abría y se moría en el
 * mismo instante, porque quien guarda si está abierto es el propio botón de
 * exportar, que dejaba de existir. Ahora cada fila decide.
 */
const CierraMenu = createContext<() => void>(() => {});

/**
 * LAS HERRAMIENTAS DE LA PANTALLA, DETRÁS DE UN SOLO BOTÓN.
 *
 * Antes eran cuatro botones redondos apilados en el borde derecho —ayuda,
 * alertas, día/noche y exportar— ocupando 250 px de alto de pantalla en todas
 * las páginas de la plataforma. Ninguno se usa a menudo, y en un portátil de
 * 13″ tapaban contenido; en el móvil hubo que inventar una regla de CSS para
 * esconderlos cuando había un modal abierto, porque se plantaban encima.
 *
 * Ahora es **uno**, y se despliega.
 *
 * **Por qué sigue flotando y no está en la cabecera**, que es lo primero que
 * se piensa: la cabecera es `sticky z-30` y crea su propio contexto de
 * apilado, así que cualquier cosa metida ahí queda **por debajo** de los
 * modales de la app, que son `z-50`. Y una de las cuatro herramientas —
 * exportar— existe precisamente para capturar el pop-up que hay abierto:
 * desde la cabecera sería inalcanzable justo cuando hace falta. El botón se
 * queda a `z-[60]`, por encima de los modales, que es lo que lo hace útil.
 *
 * Lleva `data-export-hide` por dos razones: no sale en las capturas, y
 * `findOpenDialog` (el que decide qué se exporta) descarta lo que cuelga de
 * ese atributo, así que el menú abierto no se confunde nunca con la ficha que
 * se quería capturar.
 */

export function MenuFlotante({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);

  const caja = useRef<HTMLDivElement | null>(null);

  /* Se cierra al tocar fuera y con Escape, como el resto de la plataforma. */
  useEffect(() => {
    if (!abierto) return;

    const alTocar = (evento: PointerEvent) => {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    };

    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierto(false);
    };

    document.addEventListener("pointerdown", alTocar);
    document.addEventListener("keydown", alPulsar);

    return () => {
      document.removeEventListener("pointerdown", alTocar);
      document.removeEventListener("keydown", alPulsar);
    };
  }, [abierto]);

  return (
    <div
      ref={caja}
      data-export-hide
      /*
      | NO lleva `data-flotante`.
      |
      | Esa marca la usa `globals.css` para esconder los flotantes cuando hay
      | un modal delante, y existía porque cuatro botones tapaban el modal en
      | el móvil. Uno solo no tapa nada, y esconderlo dejaría sin exportar
      | justo el pop-up que se quería exportar.
      */
      className="fixed bottom-20 right-5 z-[60] flex flex-col items-end gap-2 print:hidden"
    >
      {abierto && (
        <div className="w-[268px] overflow-hidden rounded-2xl border border-white/10 bg-[#121820]/95 shadow-2xl backdrop-blur">
          <p className="border-b border-white/10 px-4 py-2.5 text-[10px] uppercase tracking-[0.2em] text-white/40">
            Herramientas
          </p>

          <CierraMenu.Provider value={() => setAbierto(false)}>
            {children}
          </CierraMenu.Provider>
        </div>
      )}

      <button
        type="button"
        aria-label={abierto ? "Cerrar herramientas" : "Herramientas"}
        aria-expanded={abierto}
        title="Ayuda, alertas, tema y exportar"
        onClick={() => setAbierto((valor) => !valor)}
        className="
          flex h-11 w-11 items-center justify-center
          rounded-full border border-white/10 bg-white/[0.06]
          text-[#C8A96B] shadow-xl backdrop-blur
          transition hover:bg-white/10
        "
      >
        {abierto ? (
          <X className="h-5 w-5" aria-hidden />
        ) : (
          <EllipsisVertical className="h-5 w-5" aria-hidden />
        )}
      </button>
    </div>
  );
}

/**
 * Una fila del menú. La usan las cuatro herramientas para pintarse igual.
 *
 * `pista` es la línea de abajo: dice qué hace la herramienta en esta pantalla
 * —de qué va la ayuda, cuántas alertas hay, si se va a exportar la ficha o la
 * página— y es lo que evita tener que abrirlas para averiguarlo.
 */
export function ItemMenuFlotante({
  icono,
  titulo,
  pista,
  onClick,
  destacado,
  mantenAbierto,
}: {
  icono: ReactNode;
  titulo: string;
  pista?: string;
  onClick: () => void;
  /** Para el que abre otro panel en vez de hacer algo al momento. */
  destacado?: boolean;
  /**
   * Deja el menú abierto al pulsar.
   *
   * Lo usa el de exportar, cuyo panel es **hijo de esta fila**: cerrar el menú
   * lo desmontaría junto con el estado que dice que está abierto. Los demás
   * abren un cajón a pantalla completa o hacen algo al momento, así que ahí
   * dejar el menú detrás sólo estorba.
   */
  mantenAbierto?: boolean;
}) {
  const cierra = useContext(CierraMenu);

  return (
    <button
      type="button"
      onClick={() => {
        onClick();

        if (!mantenAbierto) cierra();
      }}
      className="flex w-full items-start gap-3 border-t border-white/10 px-4 py-3 text-left transition first:border-t-0 hover:bg-white/10"
    >
      <span className="mt-0.5 shrink-0 text-[#C8A96B]">{icono}</span>

      <span className="min-w-0">
        <span className="block text-sm font-medium text-white">
          {titulo}
          {destacado ? "…" : ""}
        </span>

        {pista && (
          <span className="block text-[11px] leading-relaxed text-white/45">
            {pista}
          </span>
        )}
      </span>
    </button>
  );
}

export default MenuFlotante;
