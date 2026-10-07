"use client";

/**
 * Elegir de qué microciclo se copia la semana de ABP (07/10/2026).
 *
 * Antes de copiar se ve qué va a pasar —cuántos bloques entran y cuántos se
 * quedan fuera por no tener su MD en esta semana—, porque copiar sobre una
 * semana ya montada es justo lo que no se quiere hacer a ciegas.
 */

import { useState } from "react";
import { ClipboardCopy } from "lucide-react";

import { Button, Dialog, Notice, Segmented, Select } from "@/components/abp/ui";
import type { ModoCopia } from "@/lib/abp/copia-micro";

export type OpcionCopia = {
  clave: string;
  etiqueta: string;
  trabajos: number;
};

export function CopiarMicro({
  destino,
  opciones,
  trabajosDestino,
  previa,
  onCopiar,
  onCerrar,
}: {
  /** «Micro 15 · Ibiza». */
  destino: string;
  opciones: OpcionCopia[];
  /** Bloques que ya tiene la semana de destino. */
  trabajosDestino: number;
  previa: (clave: string, modo: ModoCopia) => { puestas: number; sinPareja: number } | null;
  onCopiar: (clave: string, modo: ModoCopia) => void;
  onCerrar: () => void;
}) {
  const [clave, setClave] = useState(opciones[0]?.clave ?? "");

  /* Con la semana vacía no hay nada que sustituir: se añade. */
  const [modo, setModo] = useState<ModoCopia>("anadir");

  const resultado = clave ? previa(clave, modo) : null;

  return (
    <Dialog
      title="Copiar de otro microciclo"
      subtitle={`Sobre ${destino}`}
      onClose={onCerrar}
      footer={
        <>
          <Button onClick={onCerrar}>Cancelar</Button>

          <Button
            tone="primary"
            icon={ClipboardCopy}
            disabled={!clave || !resultado || resultado.puestas === 0}
            onClick={() => onCopiar(clave, modo)}
          >
            Copiar {resultado?.puestas ? `${resultado.puestas} bloque(s)` : ""}
          </Button>
        </>
      }
    >
      {opciones.length === 0 ? (
        <Notice tone="info" title="No hay otro microciclo con trabajo">
          Para copiar hace falta otra semana con algún bloque de balón parado ya puesto.
        </Notice>
      ) : (
        <div className="space-y-4">
          <Select
            label="Copiar la semana de"
            value={clave}
            options={opciones.map((opcion) => ({
              value: opcion.clave,
              label: `${opcion.etiqueta} (${opcion.trabajos} bloque${opcion.trabajos === 1 ? "" : "s"})`,
            }))}
            onChange={setClave}
          />

          {trabajosDestino > 0 && (
            <div>
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                Esta semana ya tiene {trabajosDestino} bloque{trabajosDestino === 1 ? "" : "s"}
              </span>

              <Segmented
                ariaLabel="Qué hacer con lo que ya hay"
                options={[
                  { key: "anadir", label: "Añadir a lo que hay" },
                  { key: "sustituir", label: "Sustituir lo que hay" },
                ]}
                value={modo}
                onChange={setModo}
              />
            </div>
          )}

          <p className="text-[12px] leading-relaxed text-white/50">
            Los bloques entran atados por MD —el MD-3 de aquella semana al MD-3 de ésta—, con sus
            aspectos, lados, minutos y escalas. Son copias: no quedan atadas a la hoja de registro.
          </p>

          {resultado && (
            <Notice tone={resultado.sinPareja > 0 ? "warn" : "info"} title={`Entran ${resultado.puestas} bloque(s)`}>
              {resultado.sinPareja > 0
                ? `${resultado.sinPareja} no tienen su MD en esta semana y se quedan fuera.`
                : "Todos encuentran su día."}
              {modo === "sustituir" && trabajosDestino > 0
                ? ` Se quitan los ${trabajosDestino} que hay ahora (se puede deshacer).`
                : ""}
            </Notice>
          )}
        </div>
      )}
    </Dialog>
  );
}
