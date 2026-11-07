"use client";

/*
|--------------------------------------------------------------------------
| NUESTRO ONCE, A MANO Y RÁPIDO (01/11/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: «que sea más sencillo, rápido y funcional cambiar el
| once titular nuestro». Encima del campo de los onces va el once por líneas
| y, debajo, el resto de la plantilla:
|
|   - tocar un puesto abre la lista con los de ESE puesto primero (y buscador);
|   - tocar a uno de abajo y luego un puesto lo mete ahí (dos toques);
|   - arrastrar de abajo a un puesto lo mete; de un puesto a otro, se cambian;
|   - «Deshacer» devuelve lo de antes, cambio a cambio.
|
| El arrastre es con eventos de puntero, no con `draggable`, que con el dedo
| no funciona (lo mismo que en Jugadores sesión). Sólo se cambia a quién lleva
| cada ficha: el tablero guarda la misma forma de siempre y la pizarra de ABP
| y Emotion lo leen igual.
*/

import Image from "next/image";
import { ArrowDownUp, Sparkles, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";

import { HUECOS } from "@/lib/data-analisis/once";
import type { BajasPartido as Bajas } from "@/hooks/useBajasPartido";
import { disponible, estadoEnPalabras, type ConBaja } from "@/lib/tactics/disponibilidad";
import { aplicaOnce, clave, huecosDelTablero, intercambia, nombreDeFicha, ordenaParaCambio, ponEnFicha, puestoDeFicha, type HuecoDelTablero } from "@/lib/tactics/editaOnce";
import type { Elegido } from "@/lib/tactics/propuestaOnce";
import type { TacticsDoc } from "@/lib/tactics/types";
import { cn } from "@/lib/utils";
import { nombrePuesto } from "@/lib/posiciones";
import type { Player } from "@/types/player";

import BajasPartido from "./BajasPartido";
import { CambioJugador, type OpcionCambio } from "./CambioJugador";
import PropuestaOnce from "./PropuestaOnce";

/** El 4-2-3-1 de arriba abajo, como se mira en la charla: el ataque arriba, la banda izquierda a la izquierda. */
const FILAS: string[][] = [["del"], ["ban-i", "media", "ban-d"], ["piv-i", "piv-d"], ["lat-i", "cen-i", "cen-d", "lat-d"], ["por"]];

const CORTO: Record<string, string> = {
  por: "POR",
  "lat-d": "LD",
  "cen-d": "DFC",
  "cen-i": "DFC",
  "lat-i": "LI",
  "piv-d": "MC",
  "piv-i": "MC",
  "ban-d": "ED",
  media: "MP",
  "ban-i": "EI",
  del: "DC",
};

/** El orden del banquillo: por línea, de atrás adelante. */
const ORDEN_PUESTO: Record<string, number> = { POR: 0, LAT: 1, CEN: 2, MED: 3, BAN: 4, DEL: 5 };

type Origen = { tipo: "hueco"; clave: string } | { tipo: "banco"; id: string };

export default function OnceTitular({
  doc,
  onChange,
  roster,
  bajas,
  rival,
}: {
  doc: TacticsDoc;
  onChange: (doc: TacticsDoc) => void;
  /** Con la baja vigente de cada uno (`useBajasPartido`). */
  roster: ConBaja[];
  bajas: Bajas;
  /** El rival del próximo partido; sin él no hay propuesta. */
  rival?: string;
}) {
  const escena = doc.scenes[0];
  const huecos = useMemo(() => huecosDelTablero(escena, roster), [escena, roster]);
  const porHueco = useMemo(() => new Map(huecos.map((h) => [h.hueco.clave, h])), [huecos]);

  /* Quién está ya en el campo: cualquier ficha nuestra con nombre, no sólo las de los huecos. */
  const enCampo = useMemo(() => new Set((escena?.tokens ?? []).filter((t) => t.kind === "home" && t.nombre?.trim()).map((t) => clave(t.nombre))), [escena]);
  const estaEnCampo = useCallback((p: Player) => enCampo.has(clave(nombreDeFicha(p))) || enCampo.has(clave(p.nombre)), [enCampo]);

  const banquillo = useMemo(
    () =>
      roster
        .filter((p) => p.activo !== false && !estaEnCampo(p))
        .sort((a, b) => {
          const libreA = disponible(a) ? 0 : 1;
          const libreB = disponible(b) ? 0 : 1;

          return (
            libreA - libreB ||
            Number(b.esCastilla) - Number(a.esCastilla) ||
            (ORDEN_PUESTO[puestoDeFicha(a).puesto] ?? 9) - (ORDEN_PUESTO[puestoDeFicha(b).puesto] ?? 9) ||
            nombreDeFicha(a).localeCompare(nombreDeFicha(b), "es")
          );
        }),
    [roster, estaEnCampo],
  );

  const onceActual = useMemo(() => Object.fromEntries(huecos.flatMap((h) => (h.token?.nombre?.trim() ? [[h.hueco.clave, h.token.nombre.trim()]] : []))), [huecos]);

  /* ---------------- Deshacer: lo de antes de cada cambio ---------------- */

  const [pasado, setPasado] = useState<TacticsDoc[]>([]);
  /*
    El doc que dejó el último cambio de este panel. Si el tablero ha cambiado
    después (una ficha arrastrada, una flecha), deshacer aquí volvería a un doc
    entero viejo y se comería ese trabajo: entonces no se deshace.
  */
  const ultimo = useRef<TacticsDoc | null>(null);
  const docActual = useRef(doc);

  useEffect(() => {
    docActual.current = doc;
  }, [doc]);

  const puedeDeshacer = () => {
    if (ultimo.current === docActual.current) return true;

    setPasado([]);
    toast("El tablero ha cambiado después: deshazlo desde el propio tablero");

    return false;
  };

  const cambia = (siguiente: TacticsDoc) => {
    if (siguiente === doc) return;

    setPasado((antes) => [...antes.slice(-30), doc]);
    ultimo.current = siguiente;
    onChange(siguiente);
  };

  const deshaz = () => {
    const anterior = pasado[pasado.length - 1];

    if (!anterior || !puedeDeshacer()) return;

    setPasado((antes) => antes.slice(0, -1));
    ultimo.current = anterior;
    onChange(anterior);
  };

  /* ---------------- Elegir y cambiar ---------------- */

  const [delBanco, setDelBanco] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [propuestaAbierta, setPropuestaAbierta] = useState(false);

  const sitio = (h: HuecoDelTablero) => ({ tokenId: h.tokenId, hueco: h.hueco.clave });

  const meteEn = (huecoClave: string, p: Player) => {
    const h = porHueco.get(huecoClave);

    if (!h) return;

    cambia(ponEnFicha(doc, sitio(h), p));
    setDelBanco(null);
  };

  const cambiaHuecos = (a: string, b: string) => {
    const ha = porHueco.get(a);
    const hb = porHueco.get(b);

    if (!ha || !hb || a === b) return;

    cambia(intercambia(doc, sitio(ha), sitio(hb)));
  };

  const tocaHueco = (huecoClave: string) => {
    if (delBanco) {
      const p = roster.find((x) => x.id === delBanco);

      if (p) meteEn(huecoClave, p);

      return;
    }

    setCambiando(huecoClave);
  };

  const opciones = useMemo<OpcionCambio[]>(() => {
    const h = cambiando ? porHueco.get(cambiando) : undefined;

    if (!h) return [];

    const actual = clave(h.token?.nombre);

    return ordenaParaCambio(
      roster
        .filter((p) => p.activo !== false && clave(nombreDeFicha(p)) !== actual)
        .map((p) => ({ ficha: p, enCampo: estaEnCampo(p) })),
      { puesto: h.hueco.puesto, lado: h.hueco.lado },
      disponible,
    ).map(({ ficha: p, enCampo: dentro, grupo }) => ({
      id: p.id,
      nombre: nombreDeFicha(p),
      dorsal: p.dorsal ? String(p.dorsal) : "",
      posicion: p.posicion,
      foto: p.foto,
      enCampo: dentro,
      grupo,
      nota: estadoEnPalabras(p) ?? undefined,
      apagado: !disponible(p),
    }));
  }, [cambiando, porHueco, roster, estaEnCampo]);

  /* ---------------- Arrastrar (ratón y dedo) ---------------- */

  const arrastre = useRef<{ origen: Origen; x0: number; y0: number; activo: boolean; texto: string } | null>(null);
  const sinClic = useRef(false);
  const [fantasma, setFantasma] = useState<{ x: number; y: number; texto: string } | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);

  const huecoBajo = (x: number, y: number) => {
    const el = typeof document === "undefined" ? null : document.elementFromPoint(x, y);

    return el?.closest("[data-hueco]")?.getAttribute("data-hueco") ?? null;
  };

  const empieza = (e: ReactPointerEvent<HTMLElement>, origen: Origen, texto: string) => {
    if (e.button !== 0) return;

    /* Con el ratón, arrastrar no debe ir seleccionando el texto de la página por debajo. */
    if (e.pointerType === "mouse") e.preventDefault();

    arrastre.current = { origen, x0: e.clientX, y0: e.clientY, activo: false, texto };
  };

  const mueve = (e: ReactPointerEvent<HTMLElement>) => {
    const a = arrastre.current;

    if (!a) return;

    if (!a.activo) {
      if (Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 8) return;

      a.activo = true;

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* Sin captura también va: el dedo ya la tiene. */
      }
    }

    setFantasma({ x: e.clientX, y: e.clientY, texto: a.texto });
    setSobre(huecoBajo(e.clientX, e.clientY));
  };

  const suelta = (e: ReactPointerEvent<HTMLElement>) => {
    const a = arrastre.current;

    arrastre.current = null;
    setFantasma(null);
    setSobre(null);

    if (!a?.activo) return;

    /* El clic que llega detrás del arrastre no cuenta. */
    sinClic.current = true;
    setTimeout(() => {
      sinClic.current = false;
    }, 0);

    const destino = huecoBajo(e.clientX, e.clientY);

    if (!destino) return;

    if (a.origen.tipo === "hueco") {
      cambiaHuecos(a.origen.clave, destino);
    } else {
      const id = a.origen.id;
      const p = roster.find((x) => x.id === id);

      if (p) meteEn(destino, p);
    }
  };

  const cancela = () => {
    arrastre.current = null;
    setFantasma(null);
    setSobre(null);
  };

  const elegidoDelBanco = delBanco ? roster.find((p) => p.id === delBanco) : undefined;
  const puestoDelElegido = elegidoDelBanco ? puestoDeFicha(elegidoDelBanco).puesto : null;

  /* ---------------- La propuesta ---------------- */

  const aplicaPropuesta = (elegidos: Elegido[]) => {
    const antes = doc;
    const siguiente = aplicaOnce(doc, elegidos);

    cambia(siguiente);
    setPropuestaAbierta(false);

    toast.success("Propuesta aplicada al once", {
      description: "La pantalla Emocional y la pizarra de balón parado ya la usan.",
      duration: 9000,
      action: {
        label: "Deshacer",
        onClick: () => {
          if (!puedeDeshacer()) return;

          setPasado((lista) => lista.filter((d) => d !== antes));
          ultimo.current = antes;
          onChange(antes);
        },
      },
    });
  };

  return (
    <section aria-label="Nuestro once titular" className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
      <header className="flex flex-wrap items-center gap-2">
        <div className="mr-auto min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C8A96B]">Nuestro once</p>
          <p className="mt-0.5 text-[11px] leading-snug text-white/50">
            {elegidoDelBanco ? `Toca el puesto donde entra ${nombreDeFicha(elegidoDelBanco)}.` : "Toca un puesto para cambiarlo, o arrastra a alguien de abajo encima."}
          </p>
        </div>

        {pasado.length > 0 && (
          <button
            type="button"
            onClick={deshaz}
            title="Vuelve el once a como estaba antes del último cambio"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Undo2 size={13} aria-hidden />
            Deshacer
          </button>
        )}

        <button
          type="button"
          onClick={() => setPropuestaAbierta((v) => !v)}
          disabled={!rival}
          aria-expanded={propuestaAbierta}
          title={rival ? `Propuesta de once para jugar contra el ${rival}` : "Hace falta el próximo partido en el calendario"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-40",
            propuestaAbierta ? "border-[#C8A96B]/60 bg-[#C8A96B]/15 text-[#C8A96B]" : "border-[#C8A96B]/40 text-[#C8A96B] hover:bg-[#C8A96B]/10",
          )}
        >
          <Sparkles size={13} aria-hidden />
          Propuesta para el partido
        </button>
      </header>

      {propuestaAbierta && rival && (
        <PropuestaOnce roster={roster} rival={rival} onceActual={onceActual} onAplica={aplicaPropuesta} onCierra={() => setPropuestaAbierta(false)} />
      )}

      {/* EL ONCE POR LÍNEAS */}
      <div className="space-y-1.5" onPointerMove={mueve} onPointerUp={suelta} onPointerCancel={cancela}>
        {FILAS.map((fila) => (
          <div key={fila.join("-")} className="flex justify-center gap-1.5">
            {fila.map((k) => {
              const h = porHueco.get(k);
              const token = h?.token;
              const jugador = h?.jugador;
              const baja = jugador && !disponible(jugador) ? estadoEnPalabras(jugador) : null;
              const encaja = puestoDelElegido !== null && h?.hueco.puesto === puestoDelElegido;
              const rotulo = HUECOS.find((x) => x.clave === k)?.rotulo ?? k;
              const nombre = token?.nombre?.trim();

              return (
                <button
                  key={k}
                  type="button"
                  data-hueco={k}
                  onPointerDown={(e) => empieza(e, { tipo: "hueco", clave: k }, nombre || rotulo)}
                  onClick={() => {
                    if (sinClic.current) return;

                    tocaHueco(k);
                  }}
                  title={nombre ? `${rotulo}: ${nombre}. Toca para cambiarlo; arrástralo a otro puesto para cambiarles el sitio.` : `${rotulo}: toca para poner a alguien`}
                  className={cn(
                    "flex min-w-0 max-w-[9.5rem] flex-1 touch-pan-y select-none items-center gap-1 rounded-xl border px-1.5 py-1.5 text-left transition sm:touch-none sm:gap-2 sm:px-2",
                    "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]",
                    sobre === k && "ring-2 ring-[#C8A96B]",
                    encaja && sobre !== k && "ring-1 ring-[#C8A96B]/60",
                    baja && "bg-amber-400/[0.08]",
                  )}
                >
                  {/* Más pequeña en el móvil: con la foto de 32 px, la línea de cuatro se quedaba en «A…» (07/11/2026). */}
                  <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-white/10 sm:h-8 sm:w-8">
                    {token?.foto ? <Image src={token.foto} alt="" fill sizes="32px" className="pointer-events-none object-cover" unoptimized draggable={false} /> : null}
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[#11161C] px-1 text-[9px] font-bold tabular-nums leading-tight text-[#C8A96B]">{token?.label ?? ""}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-white/90">{nombre || "Toca para poner"}</span>
                    <span className={cn("block truncate text-[11px]", baja ? "text-amber-300" : "text-white/45")}>{baja ?? CORTO[k]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* EL RESTO: TOCAR Y LUEGO UN PUESTO, O ARRASTRAR */}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          <ArrowDownUp size={11} aria-hidden />
          Para entrar
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-1" onPointerMove={mueve} onPointerUp={suelta} onPointerCancel={cancela}>
          {banquillo.map((p) => {
            const libre = disponible(p);
            const estado = estadoEnPalabras(p);
            const elegido = delBanco === p.id;

            return (
              <button
                key={p.id}
                type="button"
                onPointerDown={(e) => empieza(e, { tipo: "banco", id: p.id }, nombreDeFicha(p))}
                onClick={() => {
                  if (sinClic.current) return;

                  setDelBanco((antes) => (antes === p.id ? null : p.id));
                }}
                aria-pressed={elegido}
                title={`${nombreDeFicha(p)}${p.posicion ? ` · ${p.posicion}` : ""}${estado ? ` · ${estado}` : ""}. Tócalo y luego un puesto, o arrástralo encima.`}
                className={cn(
                  "flex shrink-0 touch-pan-x select-none items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] transition",
                  elegido ? "border-[#C8A96B]/60 bg-[#C8A96B]/15 text-[#C8A96B]" : "border-white/10 bg-white/[0.03] text-white/75 hover:bg-white/[0.07]",
                  !libre && "opacity-55",
                )}
              >
                <span className="font-semibold tabular-nums text-[#C8A96B]">{p.dorsal ?? ""}</span>
                <span className="max-w-[8rem] truncate font-semibold">{nombreDeFicha(p)}</span>
                {/* El puesto en palabras: «8» era «Interior» (07/11/2026, jueces). */}
                <span className="text-[11px] text-white/45">{estado ?? nombrePuesto(p.posicion ?? "")}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quién no está para el próximo partido: lo marcado aquí manda, no la columna ESTADO de la hoja. */}
      <BajasPartido roster={roster} bajas={bajas} preelegido={delBanco} />

      {cambiando && (
        <CambioJugador
          titulo={porHueco.get(cambiando)?.token?.nombre ? `Cambiar a ${porHueco.get(cambiando)?.token?.nombre}` : `Poner ${HUECOS.find((x) => x.clave === cambiando)?.rotulo.toLowerCase() ?? ""}`}
          equipo={`Real Madrid Castilla · ${HUECOS.find((x) => x.clave === cambiando)?.rotulo.toLowerCase() ?? ""}`}
          opciones={opciones}
          onElige={(id) => {
            const p = roster.find((x) => x.id === id);

            if (p) meteEn(cambiando, p);

            setCambiando(null);
          }}
          onCierra={() => setCambiando(null)}
        />
      )}

      {fantasma && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-[130%] rounded-full border border-[#C8A96B]/60 bg-[#11161C] px-3 py-1 text-[12px] font-semibold text-white/90 shadow-xl"
          style={{ left: fantasma.x, top: fantasma.y }}
        >
          {fantasma.texto}
        </div>
      )}
    </section>
  );
}
