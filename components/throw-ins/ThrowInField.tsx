"use client";

// Mapa de flechas: de dónde sale cada saque y hacia dónde va el envío.
//
// El destino sale de Zona_Caida, que guarda la dirección del envío
// ("Progresión Carril Exterior", "Retroceso Carril Interior", "Area").
// Antes se buscaba "izq"/"der" en esa columna, que nunca aparece ahí, así que
// todas las flechas apuntaban al mismo punto.
//
// Cada zona dibuja UNA flecha por dirección registrada, con grosor según su
// peso. Con una sola flecha dominante, una zona repartida al 50% entre
// progresión y retroceso se leía como si sólo progresara.

import { useMemo, useState } from "react";

import BoardViewport from "@/components/board/BoardViewport";
import {
  type Banda,
  BANDA_LABEL,
  direccionDe,
  esProduccion,
  heatColor,
  type Mode,
  parseBanda,
  parseResultado,
  parseZona,
  read,
  type RecordRow,
  resultInk,
  textoSobre,
  tonoDeModo,
  type Zona,
  zonaLabel,
} from "./throwInModel";

type ThrowInFieldProps = {
  rows: RecordRow[];
  mode: Mode;
};

type Salida = {
  clave: string;
  label: string;
  sentido: string;
  carril: string;
  count: number;
  produccion: number;
};

type FieldNode = {
  key: string;
  banda: Banda;
  zona: Zona;
  count: number;
  produccion: number;
  rows: RecordRow[];
  salidas: Salida[];
};

/** Igual que en el mapa de zonas: la vista defensiva gira el campo 180 grados. */
function origen(banda: Banda, zona: Zona, mode: Mode) {
  const flip = mode === "defensive";
  const x = flip ? [85, 50, 15][zona - 1] : [15, 50, 85][zona - 1];
  const arriba = flip ? banda === "der" : banda === "izq";

  return { x, y: arriba ? 7 : 93, dir: flip ? -1 : 1 };
}

/** Destino de una dirección concreta salida de esa zona. */
function destino(banda: Banda, zona: Zona, mode: Mode, salida: Salida) {
  const { x, y, dir } = origen(banda, zona, mode);

  if (salida.sentido === "area") {
    return { x: mode === "defensive" ? 12 : 88, y: 50 };
  }

  const haciaCentro = y < 50 ? 1 : -1;
  const avance = salida.sentido === "progresion" ? 20 : salida.sentido === "retroceso" ? -16 : 8;
  const desplazamientoY = salida.carril === "interior" ? 34 : salida.carril === "exterior" ? 13 : 20;

  return {
    x: Math.max(8, Math.min(92, x + dir * avance)),
    y: Math.max(10, Math.min(90, y + haciaCentro * desplazamientoY)),
  };
}

export function ThrowInField({ rows, mode }: ThrowInFieldProps) {
  // Guardamos la clave, no el nodo: con el nodo el panel seguía mostrando las
  // acciones capturadas al pulsar aunque después se cambiaran los filtros.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const isOffensive = mode === "offensive";
  const tono = tonoDeModo(mode);

  const { nodes, sinUbicar } = useMemo(() => {
    const grouped = new Map<string, FieldNode>();
    const salidasPorZona = new Map<string, Map<string, Salida>>();
    let sinUbicar = 0;

    rows.forEach((row) => {
      const banda = parseBanda(row);
      const zona = parseZona(row);

      if (!banda || !zona) {
        sinUbicar += 1;
        return;
      }

      const key = `${banda}-${zona}`;
      const node: FieldNode =
        grouped.get(key) ?? { key, banda, zona, count: 0, produccion: 0, rows: [], salidas: [] };

      const produce = esProduccion(parseResultado(read(row, "Resultado_Final")), mode);

      node.count += 1;
      node.rows.push(row);
      if (produce) node.produccion += 1;
      grouped.set(key, node);

      const direccion = direccionDe(row);
      const clave = `${direccion.sentido ?? "otro"}|${direccion.carril ?? "otro"}`;
      const salidas = salidasPorZona.get(key) ?? new Map<string, Salida>();
      const salida: Salida = salidas.get(clave) ?? {
        clave,
        label: direccion.label,
        sentido: direccion.sentido ?? "otro",
        carril: direccion.carril ?? "otro",
        count: 0,
        produccion: 0,
      };

      salida.count += 1;
      if (produce) salida.produccion += 1;
      salidas.set(clave, salida);
      salidasPorZona.set(key, salidas);
    });

    grouped.forEach((node, key) => {
      node.salidas = [...(salidasPorZona.get(key)?.values() ?? [])].sort((a, b) => b.count - a.count);
    });

    return {
      nodes: [...grouped.values()].sort((a, b) => b.count - a.count),
      sinUbicar,
    };
  }, [rows, mode]);

  // El detalle se deriva de los datos vivos: sigue los filtros o se cierra solo.
  const selected = nodes.find((node) => node.key === selectedKey) ?? null;
  const maxCount = Math.max(...nodes.map((node) => node.count), 1);

  return (
    <section className="mb-7 rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-xl md:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#C8A96B]">Situación global</p>
          <h2 className="mt-1 text-xl font-semibold md:text-2xl">
            Mapa de saques de banda {isOffensive ? "ofensivos" : "defensivos"}
          </h2>
        </div>
        <p className="text-sm text-slate-400">Pulsa una zona para ver las acciones registradas.</p>
      </div>

      <div className="relative mx-auto aspect-[16/10] w-full max-w-[1200px] overflow-hidden rounded-2xl border border-emerald-200/20 shadow-inner">
        <BoardViewport className="absolute inset-0" label="Mapa de saques de banda">
        {/*
          El césped viaja dentro del visor: si se quedara en el marco, al
          acercarse las flechas se despegarían del campo.
        */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ backgroundImage: "url(/emotional-field-bg.png)", backgroundSize: "cover", backgroundPosition: "center" }}
        />

        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Campo de fútbol completo con distribución de saques de banda"
        >
          <defs>
            <filter id="field-glow">
              <feGaussianBlur stdDeviation="0.7" />
            </filter>
          </defs>

          {/* Flechas primero: los discos de zona quedan siempre por encima. */}
          {nodes.map((node) => {
            const { x, y } = origen(node.banda, node.zona, mode);

            return node.salidas.map((salida) => {
              const target = destino(node.banda, node.zona, mode, salida);
              const color = heatColor(salida.produccion / salida.count, tono);
              const peso = salida.count / node.count;

              return (
                <g key={`${node.key}-${salida.clave}`} pointerEvents="none">
                  <title>
                    {`${BANDA_LABEL[node.banda]} · ${zonaLabel(node.zona, mode)} · ${salida.label}: ${salida.count} de ${node.count}`}
                  </title>
                  <path
                    d={`M ${x} ${y} Q ${(x + target.x) / 2} ${(y + target.y) / 2 - 4} ${target.x} ${target.y}`}
                    fill="none"
                    stroke={color}
                    strokeOpacity={0.35 + peso * 0.5}
                    strokeWidth={0.35 + peso * 1.1}
                    strokeLinecap="round"
                  />
                  <circle
                    cx={target.x}
                    cy={target.y}
                    r={0.7 + peso * 1.1}
                    fill={color}
                    fillOpacity="0.85"
                    filter="url(#field-glow)"
                  />
                </g>
              );
            });
          })}

          {nodes.map((node) => {
            const { x, y } = origen(node.banda, node.zona, mode);
            const radius = 3 + Math.sqrt(node.count / maxCount) * 3.6;
            const color = heatColor(node.produccion / node.count, tono);
            const isSelected = selectedKey === node.key;
            // La cifra se pintaba siempre en azul noche, pero el disco toma el
            // color del mapa de calor: una zona sin producción queda casi negra
            // y el número desaparecía. Se decide por la luminancia del relleno.
            const textoDisco = textoSobre(color);
            // Y el cuerpo se ajusta al hueco: con tamaño fijo un contador de
            // tres dígitos se salía del disco más pequeño.
            const digitos = String(node.count).length;
            const cuerpo = Math.min(3.2, (radius * 1.7) / digitos);

            return (
              <g
                key={node.key}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={`${BANDA_LABEL[node.banda]}, ${zonaLabel(node.zona, mode)}, ${node.count} acciones`}
                onClick={() => setSelectedKey(isSelected ? null : node.key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedKey(isSelected ? null : node.key);
                  }
                }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={radius + 0.9}
                  fill="none"
                  stroke={isSelected ? "#FFF7E5" : color}
                  strokeOpacity={isSelected ? 1 : 0.55}
                  strokeWidth={isSelected ? 0.8 : 0.55}
                />
                <circle cx={x} cy={y} r={radius} fill={color} fillOpacity="0.96" stroke="#FFF7E5" strokeWidth="0.35" />
                <text
                  x={x}
                  y={y + cuerpo * 0.35}
                  textAnchor="middle"
                  fill={textoDisco}
                  fontSize={cuerpo}
                  fontWeight="700"
                  pointerEvents="none"
                >
                  {node.count}
                </text>
              </g>
            );
          })}
        </svg>
        </BoardViewport>

        <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-[#07111F]/80 px-3 py-2 text-xs text-slate-200 backdrop-blur">
          {isOffensive
            ? "Atacamos hacia la portería rival (derecha)"
            : "El rival ataca hacia nuestra portería (izquierda)"}
        </div>
        <div className="pointer-events-none absolute bottom-4 left-4 max-w-[75%] rounded-lg bg-[#07111F]/80 px-3 py-2 text-xs text-slate-200 backdrop-blur">
          {nodes.length
            ? `${nodes.length} zonas activas · tamaño = volumen · grosor de flecha = peso de la dirección · color = ${
                isOffensive ? "producción generada" : "peligro concedido"
              }`
            : "Sin zonas activas todavía"}
          {sinUbicar ? ` · ${sinUbicar} sin banda o zona` : ""}
        </div>

        {!nodes.length ? (
          <div className="absolute inset-0 grid place-items-center bg-[#07111F]/45 p-6 text-center">
            <div>
              <p className="text-lg font-medium">El mapa aparecerá al registrar los saques.</p>
              <p className="mt-1 text-sm text-slate-300">
                Completa <strong>Perfil</strong> y <strong>Zona_Saque</strong> en la hoja para situar cada acción.
              </p>
            </div>
          </div>
        ) : null}

        {selected ? (
          <div className="absolute inset-x-3 bottom-3 max-h-[64%] overflow-y-auto rounded-2xl border border-white/10 bg-[#07111F]/95 p-4 shadow-2xl backdrop-blur-md sm:left-auto sm:right-3 sm:w-[360px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#C8A96B]">Zona de saque</p>
                <h3 className="mt-1 text-lg font-semibold">{BANDA_LABEL[selected.banda]}</h3>
                <p className="text-sm text-slate-400">{zonaLabel(selected.zona, mode)}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {selected.count} {selected.count === 1 ? "acción" : "acciones"} ·{" "}
                  {Math.round((selected.produccion / selected.count) * 100)}%{" "}
                  {isOffensive ? "producción" : "peligro concedido"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar detalle"
                onClick={() => setSelectedKey(null)}
                className="rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {selected.salidas.map((salida) => (
                <span
                  key={salida.clave}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300"
                >
                  {salida.label} · {salida.count}
                </span>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {selected.rows.map((row, index) => {
                const resultado = parseResultado(read(row, "Resultado_Final"));

                return (
                  <div
                    key={`${read(row, "JORNADA")}-${index}`}
                    className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm"
                  >
                    <div className="flex justify-between gap-3">
                      <p className="font-medium">
                        {read(row, "JORNADA") || "Partido"}{" "}
                        <span className="font-normal text-slate-400">· {read(row, "Rival") || "Sin rival"}</span>
                      </p>
                      <p className="shrink-0 text-slate-400">{read(row, "Tiempo") || "-"}</p>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <p className="rounded-lg bg-white/5 px-2 py-1.5">
                        <span className="block text-slate-400">Envío</span>
                        {read(row, "Tipo_Envio") || "-"}
                      </p>
                      <p className="rounded-lg bg-white/5 px-2 py-1.5">
                        <span className="block text-slate-400">Dirección</span>
                        {direccionDe(row).label}
                      </p>
                      <p className="col-span-2 rounded-lg bg-white/5 px-2 py-1.5">
                        <span className="block text-slate-400">Resultado</span>
                        <span style={{ color: resultInk(resultado.label) }}>{resultado.label}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
