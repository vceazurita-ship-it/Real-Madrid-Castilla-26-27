"use client";

/**
 * «Quién marca a quién» del córner defensivo (27/10/2026).
 *
 * Lee su once, sus remates de ABP, la plantilla con alturas y Wyscout; lee
 * nuestro once (el de la pizarra táctica; si no es de este rival, Valoraciones
 * + lo cambiado en Duelos) y propone las marcas
 * (`lib/abp/marcas-corner.ts`). En la ventana, cada marca se puede cambiar —a
 * quién ponemos y a quién marca— o dejar en blanco, con la altura y los
 * aéreos de cada uno a la vista. La altura de los nuestros que Wyscout no trae
 * se escribe aquí y se guarda (`abp:alturas-nuestros`).
 *
 * Al aplicar, cada marca lleva el dorsal de su rival en la casilla de encima
 * de la cabeza y en el panel. Se deshace con Ctrl+Z.
 */

import { useState } from "react";
import { Crosshair, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button, Dialog } from "@/components/abp/ui";
import {
  motivoAtacante,
  motivoMarcador,
  ordenaAtacantes,
  ordenaMarcadores,
  proponMarcas,
  type Atacante,
  type Emparejamiento,
  type Marcador,
} from "@/lib/abp/marcas-corner";
import { puestosDeGrupo, type SlidePizarra } from "@/lib/abp/pizarra";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { cargaDatosMarcas, huecosDeMarca } from "@/lib/abp/marcas-datos";
import type { Player } from "@/types/player";


export type FilaMarca = {
  puesto: string;
  /** `null`: el hueco se queda vacío. */
  playerId: string | null;
  /** "" : la casilla del dorsal, en blanco. */
  dorsal: string;
};

type Datos = {
  plantel: Marcador[];
  atacantes: Atacante[];
  /** Lo que ya había en la diapositiva. */
  yaPuestos: Map<string, string>;
  ocupados: Set<string>;
  fuente: string;
};

export function PropuestaMarcas({
  slide,
  rival,
  players,
  onAplicar,
}: {
  slide: SlidePizarra;
  rival: string;
  players: Player[];
  onAplicar: (filas: FilaMarca[]) => void;
}) {
  const [cargando, setCargando] = useState(false);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [filas, setFilas] = useState<Emparejamiento[] | null>(null);

  /* Las alturas de los nuestros que Wyscout no trae, escritas aquí (cm por id). */
  const { value: alturas, setValue: setAlturas } = useRemoteDoc<Record<string, number>>({
    key: "abp:alturas-nuestros",
    kind: "abp",
    fallback: {},
  });

  const puestos = puestosDeGrupo(slide, "marcas");

  /* La altura escrita a mano manda sobre la de Wyscout. */
  const conAltura = (m: Marcador): Marcador => (alturas[m.playerId] ? { ...m, altura: alturas[m.playerId] } : m);

  const propone = (d: Datos) =>
    setFilas(
      proponMarcas({
        puestos: puestos.map((p) => p.key),
        yaPuestos: d.yaPuestos,
        ocupados: d.ocupados,
        plantel: d.plantel.map(conAltura),
        atacantes: d.atacantes,
      }),
    );

  const calcula = async () => {
    if (!rival) return;

    setCargando(true);

    try {
      /* Los datos viven en lib/abp/marcas-datos.ts: los usa también la exportación. */
      const base = await cargaDatosMarcas(rival, players);

      if (!base) {
        toast.info(`De ${rival} no hay once ni plantilla para proponer marcas.`);

        return;
      }

      const { yaPuestos, ocupados } = huecosDeMarca(slide);
      const nuevos: Datos = { plantel: base.plantel, atacantes: base.atacantes, yaPuestos, ocupados, fuente: base.fuente };

      setDatos(nuevos);
      propone(nuevos);
    } catch (error) {
      console.error("[abp-pizarra] propuesta de marcas", error);
      toast.error("No se ha podido preparar la propuesta de marcas");
    } finally {
      setCargando(false);
    }
  };

  const cierra = () => {
    setFilas(null);
    setDatos(null);
  };

  const aplica = () => {
    if (!filas) return;

    onAplicar(filas.map((fila) => ({ puesto: fila.puesto, playerId: fila.marcador?.playerId ?? null, dorsal: fila.atacante?.dorsal ?? "" })));
    cierra();
    toast.success("Marcas puestas: el dorsal va en la casilla de cada uno. Ctrl+Z lo deshace.");
  };

  const cambiaFila = (puesto: string, cambio: Partial<Emparejamiento>) =>
    setFilas((antes) => antes?.map((fila) => (fila.puesto === puesto ? { ...fila, ...cambio } : fila)) ?? null);

  const guardaAltura = (playerId: string, texto: string) => {
    const cm = Math.round(Number(texto.replace(",", ".")) * (Number(texto.replace(",", ".")) < 3 ? 100 : 1));

    setAlturas((antes) => {
      const resto = { ...antes };

      if (cm >= 150 && cm <= 215) resto[playerId] = cm;
      else delete resto[playerId];

      return resto;
    });

    /* Que la fila enseñe ya la altura nueva. */
    setFilas(
      (antes) =>
        antes?.map((fila) =>
          fila.marcador?.playerId === playerId ? { ...fila, marcador: { ...fila.marcador, altura: cm >= 150 && cm <= 215 ? cm : null } } : fila,
        ) ?? null,
    );
  };

  const sigla = (puesto: string) => puestos.find((p) => p.key === puesto)?.sigla ?? "";

  const plantel = datos ? ordenaMarcadores(datos.plantel.map(conAltura)) : [];
  const atacantes = datos ? ordenaAtacantes(datos.atacantes) : [];
  const selector =
    "min-w-0 max-w-full rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1.5 text-sm text-white outline-none focus:border-[#C8A96B]/60";

  return (
    <>
      <Button
        icon={Crosshair}
        onClick={() => void calcula()}
        disabled={cargando || !rival}
        title="Propone quién marca a quién: su once por remates de ABP, altura y aéreos, contra los nuestros por puesto, altura y aéreos"
      >
        {cargando ? "Cruzando onces…" : "Quién marca a quién"}
      </Button>

      {filas && datos && (
        <Dialog
          title="Quién marca a quién"
          subtitle={`Su más peligroso por arriba, para nuestro mejor defendiendo el área. Cambia lo que quieras o deja una marca en blanco. ${datos.fuente}`}
          onClose={cierra}
          footer={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button icon={RefreshCw} onClick={() => propone(datos)} title="Vuelve a proponer con las alturas escritas">
                Volver a proponer
              </Button>
              <Button onClick={cierra}>Cerrar</Button>
              <Button icon={Crosshair} onClick={aplica}>
                Poner en la pizarra
              </Button>
            </div>
          }
        >
          <ol className="space-y-2">
            {filas.map((fila) => (
              <li key={fila.puesto} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-9 shrink-0 font-semibold text-[#D8B45A]">{sigla(fila.puesto)}</span>

                  <select
                    aria-label={`Quién va en ${sigla(fila.puesto)}`}
                    value={fila.marcador?.playerId ?? ""}
                    onChange={(e) => cambiaFila(fila.puesto, { marcador: plantel.find((m) => m.playerId === e.target.value) ?? null })}
                    className={`${selector} flex-1`}
                  >
                    <option value="" className="bg-[#11161C]">— En blanco —</option>
                    {plantel.map((m) => (
                      <option key={m.playerId} value={m.playerId} className="bg-[#11161C]">
                        {m.nombre}
                        {m.titular ? " · once" : ""}
                      </option>
                    ))}
                  </select>

                  <span className="text-white/35">→</span>

                  <select
                    aria-label={`A quién marca ${sigla(fila.puesto)}`}
                    value={fila.atacante?.clave ?? ""}
                    onChange={(e) => cambiaFila(fila.puesto, { atacante: atacantes.find((a) => a.clave === e.target.value) ?? null })}
                    className={`${selector} flex-1`}
                  >
                    <option value="" className="bg-[#11161C]">— En blanco —</option>
                    {atacantes.map((a) => (
                      <option key={a.clave} value={a.clave} className="bg-[#11161C]">
                        {a.dorsal ? `${a.dorsal} · ` : ""}
                        {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-1.5 grid gap-1 pl-11 text-[11px] text-white/50 sm:grid-cols-2">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {fila.marcador && (
                      <>
                        {motivoMarcador(fila.marcador)}
                        {!fila.marcador.altura && (
                          <input
                            key={fila.marcador.playerId}
                            inputMode="decimal"
                            placeholder="Altura (1,85)"
                            aria-label={`Altura de ${fila.marcador.nombre}`}
                            onBlur={(e) => e.target.value.trim() && guardaAltura(fila.marcador!.playerId, e.target.value.trim())}
                            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                            className="w-24 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[11px] text-white placeholder:text-white/30"
                          />
                        )}
                      </>
                    )}
                  </span>
                  <span>{fila.atacante ? motivoAtacante(fila.atacante) : ""}</span>
                </div>
              </li>
            ))}
          </ol>
        </Dialog>
      )}
    </>
  );
}
