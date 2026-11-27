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

import { useMemo } from "react";

import BoardViewport from "@/components/board/BoardViewport";
import {
  type Banda,
  BANDA_LABEL,
  direccionDe,
  esFavorable,
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
  /** Filtradas por todo menos por banda y zona: el campo las pinta todas. */
  rows: RecordRow[];
  mode: Mode;
  /** Los filtros del panel, para marcar la zona elegida. */
  filtros: Record<string, string>;
  /** Pulsar una zona filtra la página entera por banda y zona a la vez. */
  onFiltrar: (pares: [string, string][]) => void;
  /** 27/11/2026 (jueces, ronda 11): la zona (número de la hoja) que cita la conclusión: se marca en el campo con contorno y rótulo. */
  zonaConclusion?: number | null;
};

/** Desde cuántos saques una zona puede ser «la que menos recupera / conserva» del mapa. */
const MUESTRA_PEOR = 10;

/* Lo mismo que lee el panel para «Perfil» y «Zona_Saque». */
const paresDe = (banda: Banda, zona: Zona): [string, string][] => [
  ["Perfil", BANDA_LABEL[banda]],
  ["Zona_Saque", `Zona ${zona}`],
];

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
  /** Saques de la zona que pasan los filtros, dirección incluida. */
  count: number;
  /** Los de la zona sin mirar la dirección: el peso de cada flecha va sobre éstos. */
  todas: number;
  produccion: number;
  /** Los que acaban con el balón para nosotros (conservado o recuperado). */
  favorables: number;
  rows: RecordRow[];
  salidas: Salida[];
};

/** Igual que en el mapa de zonas: la vista defensiva da la vuelta a las zonas; la banda es siempre la nuestra. */
function origen(banda: Banda, zona: Zona, mode: Mode) {
  const flip = mode === "defensive";
  const x = flip ? [85, 50, 15][zona - 1] : [15, 50, 85][zona - 1];
  /*
  | La banda de la hoja es la del Castilla en los dos modos (la derecha es la
  | de nuestro lateral derecho, saque quien saque: así la apunta el analista
  | y así la escribe la base del timeline). Con nuestra portería a la
  | izquierda, nuestra izquierda va arriba siempre: sólo gira la zona.
  */
  const arriba = banda === "izq";

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

export function ThrowInField({ rows, mode, filtros, onFiltrar, zonaConclusion = null }: ThrowInFieldProps) {
  /*
  | La zona elegida ya no es un estado de aquí: es el filtro de la página.
  |
  | Pulsar un disco filtra todo por esa banda y esa zona; el detalle se abre
  | cuando las dos coinciden con un disco y se cierra quitando el filtro. Si
  | sólo hay una puesta —la banda desde el desplegable, por ejemplo— se
  | resaltan los discos que la cumplen y se apagan los demás.
  */
  const filtroBanda = filtros.Perfil && filtros.Perfil !== "ALL" ? filtros.Perfil : null;
  const filtroZona = filtros.Zona_Saque && filtros.Zona_Saque !== "ALL" ? filtros.Zona_Saque : null;
  const cumple = (banda: Banda, zona: Zona) =>
    (!filtroBanda || filtroBanda === BANDA_LABEL[banda]) &&
    (!filtroZona || filtroZona === `Zona ${zona}`);
  const hayFiltro = Boolean(filtroBanda || filtroZona);
  const filtroDireccion =
    filtros.Zona_Caida && filtros.Zona_Caida !== "ALL" ? filtros.Zona_Caida : null;
  const isOffensive = mode === "offensive";
  const tono = tonoDeModo(mode);

  const filtroResultado =
    filtros.Resultado_Final && filtros.Resultado_Final !== "ALL" ? filtros.Resultado_Final : null;

  const { nodes, sinUbicar } = useMemo(() => {
    const grouped = new Map<string, FieldNode>();
    const salidasPorZona = new Map<string, Map<string, Salida>>();
    let sinUbicar = 0;

    /*
    | Al campo le llegan las filas sin filtrar por banda, zona, dirección ni
    | resultado. El resultado no lo pinta: se aplica aquí a todo. La dirección
    | sí —son las flechas—: el disco cuenta sólo la elegida, pero las flechas
    | se calculan con todas, para que la elegida salga en su peso real y las
    | demás sigan ahí, apagadas, para cambiar de opinión.
    */
    rows.forEach((row) => {
      const resultado = parseResultado(read(row, "Resultado_Final"));

      if (filtroResultado && resultado.label !== filtroResultado) return;

      const banda = parseBanda(row);
      const zona = parseZona(row);
      const direccion = direccionDe(row);
      const cuenta = !filtroDireccion || direccion.label === filtroDireccion;

      if (!banda || !zona) {
        if (cuenta) sinUbicar += 1;
        return;
      }

      const key = `${banda}-${zona}`;
      const node: FieldNode =
        grouped.get(key) ??
        { key, banda, zona, count: 0, todas: 0, produccion: 0, favorables: 0, rows: [], salidas: [] };

      const produce = esProduccion(resultado, mode);

      node.todas += 1;
      if (cuenta) {
        node.count += 1;
        node.rows.push(row);
        if (produce) node.produccion += 1;
        if (esFavorable(resultado)) node.favorables += 1;
      }
      grouped.set(key, node);

      /*
      | Una flecha por etiqueta, no por sentido y carril: la flecha filtra por
      | su etiqueta, y dos etiquetas juntas en una flecha filtraban sólo por
      | la primera que apareciera.
      */
      const clave = direccion.label;
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
      /* Una zona sin ninguna de la dirección elegida no tiene disco. */
      nodes: [...grouped.values()].filter((node) => node.count > 0).sort((a, b) => b.count - a.count),
      sinUbicar,
    };
  }, [rows, mode, filtroDireccion, filtroResultado]);

  // El detalle se deriva de los datos vivos: sigue los filtros o se cierra solo.
  const selected =
    filtroBanda && filtroZona
      ? nodes.find((node) => cumple(node.banda, node.zona)) ?? null
      : null;
  const maxCount = Math.max(...nodes.map((node) => node.count), 1);
  /*
  | 27/11/2026 (jueces, ronda 11): el ejemplo de la leyenda sale del disco más
  | grande de verdad (antes, un «17/44 · 39 %» inventado), y en el campo se
  | marcan la zona de la conclusión y el disco que menos conserva o recupera
  | (con 10 saques o más).
  */
  const ejemplo = nodes[0] ?? null;
  const peor =
    [...nodes]
      .filter((node) => node.count >= MUESTRA_PEOR)
      .sort((a, b) => a.favorables / a.count - b.favorables / b.count)[0] ?? null;
  const enConclusion = (node: FieldNode) => zonaConclusion != null && node.zona === zonaConclusion;

  return (
    <section className="mb-7 rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-xl md:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#C8A96B]">Situación global</p>
          <h2 className="mt-1 text-xl font-semibold md:text-2xl">
            Mapa de saques de banda {isOffensive ? "ofensivos" : "defensivos"}
          </h2>
        </div>
        <p className="text-sm text-slate-400">
          Pulsa una zona o una flecha para filtrar la página; otra vez para quitarlo.
        </p>
      </div>

      {/* 17/11/2026 (jueces, ronda 20): la dirección del ataque, en grande y encima del campo. */}
      {/* 20/11/2026 (jueces, ronda 5): una línea también a 390 px, y el campo un tercio más bajo en escritorio (900 px de ancho como mucho). */}
      <p className="mx-auto mb-2 flex w-full max-w-[min(900px,calc((100dvh-300px)*1.6))] items-center justify-between gap-2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.1em] text-white/70 sm:text-[12px] sm:tracking-[0.14em]">
        <span>{isOffensive ? "Nuestra portería" : <>← Atacan hacia aquí<span className="hidden sm:inline"> (el rival)</span></>}</span>
        <span style={{ color: "var(--rmcf-gold-ink)" }}>{isOffensive ? "Atacamos →" : "Su portería"}</span>
      </p>
      <div className="relative mx-auto aspect-[16/10] w-full max-w-[min(900px,calc((100dvh-300px)*1.6))] overflow-hidden rounded-2xl border border-emerald-200/20 shadow-inner">
        {/* 27/11/2026 (jueces, ronda 11): sin los mandos de zoom en el móvil, que tapaban los discos de la derecha (debajo va la lista «Por zona»). */}
        <BoardViewport className="absolute inset-0" label="Mapa de saques de banda" mandosClassName="hidden sm:flex">
        {/*
          El césped viaja dentro del visor: si se quedara en el marco, al
          acercarse las flechas se despegarían del campo.
        */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ backgroundImage: "url(/emotional-field-bg.webp)", backgroundSize: "cover", backgroundPosition: "center" }}
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
              const peso = salida.count / node.todas;

              return (
                /* La flecha filtra por su dirección: es el «hacia dónde» del
                   saque, la otra mitad de lo que cuenta el campo. */
                <g
                  key={`${node.key}-${salida.clave}`}
                  className="cursor-pointer"
                  opacity={
                    (hayFiltro && !cumple(node.banda, node.zona)) ||
                    (filtroDireccion && filtroDireccion !== salida.label)
                      ? 0.3
                      : 1
                  }
                  onClick={() => onFiltrar([["Zona_Caida", salida.label]])}
                >
                  <title>
                    {`${BANDA_LABEL[node.banda]} · ${zonaLabel(node.zona, mode)} · ${salida.label}: ${salida.count} de ${node.todas} · Pulsa para filtrar`}
                  </title>
                  {/* Trazo invisible y ancho para poder acertar con el dedo. */}
                  <path
                    d={`M ${x} ${y} Q ${(x + target.x) / 2} ${(y + target.y) / 2 - 4} ${target.x} ${target.y}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={3}
                  />
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
            const resaltado = hayFiltro && cumple(node.banda, node.zona);
            const apagado = hayFiltro && !resaltado;
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
                aria-label={`${zonaLabel(node.zona, mode)}, ${BANDA_LABEL[node.banda].toLowerCase()}: ${node.count} saques, ${Math.round((node.favorables / node.count) * 100)} % ${isOffensive ? "conservados" : "recuperados"}, ${Math.round((node.produccion / node.count) * 100)} % ${isOffensive ? "a último tercio o más" : "le llegan a último tercio o más"}. Pulsa para filtrar`}
                aria-pressed={resaltado}
                opacity={apagado ? 0.35 : 1}
                onClick={() => onFiltrar(paresDe(node.banda, node.zona))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onFiltrar(paresDe(node.banda, node.zona));
                  }
                }}
              >
                <title>{`${zonaLabel(node.zona, mode)} · ${BANDA_LABEL[node.banda].toLowerCase()} · ${node.count} saques · ${Math.round((node.favorables / node.count) * 100)} % ${isOffensive ? "conservados" : "recuperados"} · Pulsa para filtrar`}</title>
                <circle
                  cx={x}
                  cy={y}
                  r={radius + 0.9}
                  fill="none"
                  stroke={resaltado ? "#C8A96B" : color}
                  strokeOpacity={resaltado ? 1 : 0.55}
                  strokeWidth={resaltado ? 0.9 : 0.55}
                />
                {(peor && peor.key === node.key) || enConclusion(node) ? (
                  <circle cx={x} cy={y} r={radius + 2.1} fill="none" stroke="#C8A96B" strokeWidth={0.75} strokeDasharray="1.6 1.1" />
                ) : null}
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
                {/* 17/11/2026 (jueces, ronda 19): cada zona dice «n saques · % conservados» (o recuperados), hacia dentro del campo.
                    Ronda 20: sobre una píldora oscura, que sobre el césped claro del modo día no se leía. */}
                {(() => {
                  /* 27/11/2026 (jueces, ronda 10): con su base («17/44 · 39 %»), no sólo el %. */
                  const rotulo = `${node.favorables}/${node.count} · ${Math.round((node.favorables / node.count) * 100)} %`;
                  /* 27/11/2026 (jueces, ronda 11): un cuerpo más grande, que a 390 px no se leía. */
                  const ancho = rotulo.length * 1.95 + 2.4;
                  const yTexto = y < 50 ? y + radius + 4.9 : y - radius - 2.4;
                  /* La marca de la conclusión y la del disco que menos conserva o recupera, por fuera del rótulo. */
                  const marca = peor && peor.key === node.key ? (isOffensive ? "menos conservamos" : "menos recuperamos") : enConclusion(node) ? "la conclusión" : "";
                  const anchoMarca = marca.length * 1.75 + 2.4;
                  const yMarca = y < 50 ? yTexto + 5.6 : yTexto - 6;
                  return (
                    <g pointerEvents="none">
                      <rect x={x - ancho / 2} y={yTexto - 3.8} width={ancho} height={5.2} rx={2.6} style={{ fill: "#07111F", fillOpacity: 0.85 }} />
                      <text x={x} y={yTexto} textAnchor="middle" fontSize="3.3" fontWeight="700" style={{ fill: "#FFFFFF" }}>
                        {rotulo}
                      </text>
                      {marca ? (
                        <>
                          <rect x={x - anchoMarca / 2} y={yMarca - 3.3} width={anchoMarca} height={4.5} rx={2.25} style={{ fill: "#C8A96B", fillOpacity: 0.95 }} />
                          <text x={x} y={yMarca} textAnchor="middle" fontSize="2.9" fontWeight="800" style={{ fill: "#07111F" }}>
                            {marca}
                          </text>
                        </>
                      ) : null}
                    </g>
                  );
                })()}
              </g>
            );
          })}
        </svg>
        </BoardViewport>

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
                aria-label="Quitar el filtro de zona"
                title="Quitar el filtro de zona"
                onClick={() => onFiltrar(paresDe(selected.banda, selected.zona))}
                className="rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {selected.salidas.map((salida) => (
                <button
                  key={salida.clave}
                  type="button"
                  title="Pulsa para filtrar"
                  onClick={() => onFiltrar([["Zona_Caida", salida.label]])}
                  className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                    filtroDireccion === salida.label
                      ? "border-[#C8A96B] bg-[#C8A96B]/15 text-[#E7D2A0]"
                      : `border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 ${filtroDireccion ? "opacity-50" : ""}`
                  }`}
                >
                  {salida.label} · {salida.count}
                </button>
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
                        {read(row, "Rival") && (
                          <span className="font-normal text-slate-400">· {read(row, "Rival")}</span>
                        )}
                      </p>
                      {read(row, "Tiempo") && (
                        <p className="shrink-0 text-slate-400">{read(row, "Tiempo")}</p>
                      )}
                    </div>
                    {/* Sólo las casillas con dato (07/11/2026). */}
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      {read(row, "Tipo_Envio") && (
                        <p className="rounded-lg bg-white/5 px-2 py-1.5">
                          <span className="block text-slate-400">Envío</span>
                          {read(row, "Tipo_Envio")}
                        </p>
                      )}
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

      {/*
      | 17/11/2026 (jueces, ronda 20): a 390 px los números de los discos no se
      | leen: en el móvil, debajo del campo, la lista de las zonas con saques,
      | y cada una filtra como su disco.
      */}
      {nodes.length ? (
        <>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55 sm:hidden">
          Por zona · {isOffensive ? "conservados" : "recuperados"} de los saques · %
        </p>
        <ul className="mt-1.5 grid gap-1.5 sm:hidden">
          {[...nodes]
            .sort((a, b) => b.count - a.count)
            .map((node) => {
              const resaltado = hayFiltro && cumple(node.banda, node.zona);
              return (
                <li key={node.key}>
                  <button
                    type="button"
                    aria-pressed={resaltado}
                    onClick={() => onFiltrar(paresDe(node.banda, node.zona))}
                    className={`flex min-h-10 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] ${
                      resaltado ? "border-[#C8A96B] bg-[#C8A96B]/10" : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: heatColor(node.produccion / node.count, tono) }} aria-hidden />
                    <span className="min-w-0 flex-1 text-white/85">
                      {BANDA_LABEL[node.banda]} · {zonaLabel(node.zona, mode)}
                      {peor && peor.key === node.key ? (
                        <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold" style={{ color: "var(--rmcf-gold-ink)", background: "rgb(var(--rmcf-ink-rgb) / .06)" }}>
                          {isOffensive ? "menos conservamos" : "menos recuperamos"}
                        </span>
                      ) : enConclusion(node) ? (
                        <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold" style={{ color: "var(--rmcf-gold-ink)", background: "rgb(var(--rmcf-ink-rgb) / .06)" }}>
                          la conclusión
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-white/90">
                      {node.favorables} de {node.count} · <b>{Math.round((node.favorables / node.count) * 100)} %</b>
                    </span>
                  </button>
                </li>
              );
            })}
        </ul>
        </>
      ) : null}

      {/*
      | 17/11/2026 (jueces, ronda 19): las leyendas iban encima del césped y en
      | el móvil tapaban el campo entero (y en el ordenador cortaban los discos
      | de la banda de abajo). Ahora van debajo, con la escala de color.
      */}
      <div className="mt-3 flex min-w-0 flex-col gap-2 text-[12px] text-white/70 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="min-w-0">
          {isOffensive ? "Atacamos hacia la derecha: nuestra portería, a la izquierda." : "El rival ataca hacia la izquierda, hacia nuestra portería."}
          {nodes.length
            ? ` Dentro del disco, los saques de la zona; junto a él, ${isOffensive ? "los que conservamos" : "los que recuperamos"} de esos saques y su %${
                ejemplo ? ` (p. ej. «${ejemplo.favorables}/${ejemplo.count} · ${Math.round((ejemplo.favorables / ejemplo.count) * 100)} %», ${zonaLabel(ejemplo.zona, mode).replace(/^Zona \d · /, "")}, ${BANDA_LABEL[ejemplo.banda].toLowerCase()})` : ""
              }.${zonaConclusion != null || peor ? ` Con contorno de oro, ${[zonaConclusion != null ? "la zona que cita la conclusión" : "", peor ? `el disco que menos ${isOffensive ? "conserva" : "recupera"} (con ${MUESTRA_PEOR} saques o más)` : ""].filter(Boolean).join(" y ")}.` : ""} El color del disco es otra medida: el % que ${isOffensive ? "llega" : "le llega"} a último tercio o más. Tamaño del disco = saques; grosor de la flecha = cuántos van en esa dirección.`
            : ""}
          {sinUbicar ? ` ${sinUbicar} ${sinUbicar === 1 ? "saque" : "saques"} sin banda o zona apuntada, fuera del campo.` : ""}
        </p>
        {nodes.length ? (
          <div className="flex shrink-0 items-center gap-2">
            {/* 20/11/2026 (jueces, ronda 4): la escala con sus valores, no «poco» y «mucho». */}
            <span>{isOffensive ? "Color: % que llega a último tercio o más" : "Color: % que le llega a último tercio o más"}</span>
            <span className="tabular-nums text-white/60">0 %</span>
            <span
              className="h-2 w-24 rounded-full"
              style={{ background: `linear-gradient(90deg, ${heatColor(0, tono)}, ${heatColor(0.5, tono)}, ${heatColor(1, tono)})` }}
              aria-hidden
            />
            <span className="tabular-nums text-white/60">100 %</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
