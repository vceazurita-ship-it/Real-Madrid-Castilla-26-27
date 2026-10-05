"use client";

/**
 * Competición · Análisis de faltas.
 *
 * Qué mide, y por qué sólo eso: **dónde se comete cada falta** y **cuánta
 * gente defendía en ese momento entre la falta y la portería que se ataca**.
 * Con esas dos cosas se contesta a lo que se pregunta el lunes —dónde nos
 * pitan, dónde pitamos nosotros y con qué defensa enfrente— sin pedirle al que
 * mira el vídeo veinte campos por jugada, que es como se abandonan estos
 * recuentos.
 *
 * El número que manda es **cuántos defensores hay entre la falta y su propia
 * portería, portero incluido**. Una falta en el mismo sitio no vale lo mismo
 * con nueve por delante que con tres: lo primero es un balón parado contra un
 * bloque hecho y lo segundo es una transición que se ha cortado con falta. De
 * ahí el apartado de «faltas que cortaron algo», que es el que de verdad se
 * lleva a la charla.
 *
 * De dónde salen los datos: NO hay proveedor. Se etiquetan viendo el partido
 * falta a falta, con el mismo método que los robos y los saques de banda.
 * `scripts/abp-clips-preparar.mjs` prepara la carpeta y
 * `scripts/faltas-datos.mjs` convierte los CSV en `lib/faltas/datos.ts`.
 *
 * El campo y la tabla van atados: se pasa por encima de un punto y se enciende
 * su fila, y al revés. Con veintitantas faltas es la diferencia entre mirar el
 * dibujo y entenderlo.
 *
 * Está en obras porque el recuento es de un partido: con una jornada no hay
 * tendencia que leer, y la pantalla lo dice en vez de dibujar porcentajes que
 * suenan a verdad.
 *
 * Todo lo que se pincha filtra (`components/faltas/FiltrosCruzados.tsx`): una
 * casilla o un rótulo del campo, una barra de distancia, un número de
 * defensores, cualquier celda de la tabla. El lado sigue siendo el mando de
 * siempre (`filtro`), y pinchar un «A favor» en cualquier sitio lo mueve; el
 * resto vive en `filtros`. La barra de «Filtrando» enseña los dos juntos.
 */

import { useMemo, useState } from "react";
import { Crosshair, Shield, Swords, Zap } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AbpHeader, Panel } from "@/components/abp/ui";
import { PARTIDOS, type Falta, type LadoFalta } from "@/lib/faltas/datos";
import { CampoFaltas, CARRILES_CAMPO, sitioEnCampo, ZONAS_CAMPO } from "@/components/faltas/CampoFaltas";
import { ComoActualizar } from "@/components/faltas/ComoActualizar";
import {
  BarraFiltros,
  Filtrable,
  TITULO_FILTRO,
  esPretemporada,
  estaActivo,
  hayFiltro,
  marcaPieza,
  pasaFiltros,
  useFiltrosCruzados,
  type ChipFiltro,
} from "@/components/faltas/FiltrosCruzados";
import {
  Conclusiones,
  Explicativo,
  useTextosExplicativos,
} from "@/components/ui/textos-analisis";

const DISTANCIAS = ["frontal", "media", "lejana"];

const TINTA_LADO: Record<LadoFalta, string> = {
  ofensivo: "#C8A96B",
  defensivo: "#F6AFB6",
};

const NOMBRE_LADO: Record<LadoFalta, string> = {
  ofensivo: "A favor",
  defensivo: "En contra",
};

/**
 * Por debajo de esto, la falta cortó una transición.
 *
 * Tres defensores contando al portero es un campo abierto: si ahí hubo falta,
 * no se estaba defendiendo un balón parado, se estaba frenando una carrera. El
 * corte está puesto a mano y se dice en pantalla, que es lo honesto con un
 * umbral que nadie ha calibrado con nada.
 */
const CORTE_TRANSICION = 3;

type Filtro = "todas" | LadoFalta;

/** Cómo se lee cada dimensión pinchable de una falta. */
/*
| La zona y el carril se leen en el campo de verdad, con el Castilla atacando
| hacia la derecha (05/10/2026), igual que los dibuja el campo: así «campo
| rival» quiere decir lo mismo en una falta nuestra que en una del rival.
| El etiquetado los guarda hacia la portería de quien saca (`sitioEnCampo`).
*/
const LECTORES: Record<string, (f: Falta) => string> = {
  zona: (f) => sitioEnCampo(f).zona,
  carril: (f) => sitioEnCampo(f).carril,
  distancia: (f) => f.distancia,
  entre: (f) => (f.entre === null ? "?" : String(f.entre)),
};

/** El rótulo de cada dimensión en la barra de «Filtrando». */
const ROTULO: Record<string, string> = {
  zona: "Zona del campo",
  carril: "Carril",
  distancia: "Distancia",
  entre: "Defendían",
};

/** "12'03\" (táctica 12:58)" o «—» cuando no se sabe. */
const minutoDe = (f: Falta) => f.minuto?.trim() || "—";

/** Si hay algún partido de pretemporada en los datos (hoy, ninguno). */
const HAY_PRETEMPORADA = PARTIDOS.some((p) => esPretemporada(p.jornada));

/** 6.25 → "6,3". */
const decimal = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** La clave que más se repite, con cuántas veces. */
function laQueMas(valores: string[]) {
  const cuenta = new Map<string, number>();

  for (const v of valores) if (v) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);

  let mejor: { clave: string; veces: number } | null = null;

  for (const [clave, veces] of cuenta) {
    if (!mejor || veces > mejor.veces) mejor = { clave, veces };
  }

  return mejor;
}

/** "2026-09-21" → "21 sep". */
function fechaCorta(iso: string) {
  const fecha = new Date(`${iso}T12:00:00`);

  if (Number.isNaN(fecha.getTime())) return iso;

  return fecha
    .toLocaleDateString("es-ES", { day: "numeric", month: "short" })
    .replace(".", "");
}

export default function FaltasPage() {
  const explicativos = useTextosExplicativos();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  /*
  | La pretemporada, fuera salvo que se pida: los amistosos no se leen igual
  | que la liga. Hoy no hay ninguno en los datos y el mando ni sale.
  */
  const [conPretemporada, setConPretemporada] = useState(false);

  const partidosVisibles = useMemo(
    () => (conPretemporada ? PARTIDOS : PARTIDOS.filter((p) => !esPretemporada(p.jornada))),
    [conPretemporada],
  );

  const [partidoId, setPartidoId] = useState<string>(partidosVisibles[0]?.id ?? "");

  /** La falta que está encendida, compartida entre el campo y la tabla. */
  const [resaltada, setResaltada] = useState<string | null>(null);

  /** Lo que se ha pinchado: zona, carril, distancia y defensores. */
  const { filtros, alterna, alternaVarios, quita, limpia } = useFiltrosCruzados();

  const partido = useMemo(
    () =>
      partidosVisibles.find((p) => p.id === partidoId) ?? partidosVisibles[0] ?? null,
    [partidoId, partidosVisibles],
  );

  /** Pinchar un lado en cualquier sitio: lo pone, o lo quita si ya estaba. */
  const alternaLado = (lado: LadoFalta) => {
    setFiltro((antes) => (antes === lado ? "todas" : lado));
    setResaltada(null);
  };

  /*
  | Las faltas del partido que pasan por los filtros, menos las dimensiones de
  | `excepto` (y, con `sinLado`, sin mirar el lado). Cada gráfica se pinta con
  | las suyas: así la de una dimensión filtrada sigue teniéndolas todas.
  */
  const filtradas = (excepto: string[] = [], sinLado = false) =>
    (partido?.faltas ?? []).filter(
      (f) =>
        (sinLado || filtro === "todas" || f.lado === filtro) &&
        pasaFiltros(f, filtros, LECTORES, excepto),
    );

  const faltas = useMemo(
    () =>
      (partido?.faltas ?? []).filter(
        (f) =>
          (filtro === "todas" || f.lado === filtro) && pasaFiltros(f, filtros, LECTORES),
      ),
    [partido, filtro, filtros],
  );

  /* El campo ignora su propio filtro de sitio: lo que no sale es de ahí. */
  const paraCampo = filtradas(["zona", "carril"]);
  const sinSitio = paraCampo.filter((f) => !sitioEnCampo(f).zona || !sitioEnCampo(f).carril).length;

  /** Cuántas hay de cada lado con los demás filtros, para los mandos y el encabezado. */
  const porLado = useMemo(() => {
    const todas = (partido?.faltas ?? []).filter((f) => pasaFiltros(f, filtros, LECTORES));

    return {
      ofensivo: todas.filter((f) => f.lado === "ofensivo").length,
      defensivo: todas.filter((f) => f.lado === "defensivo").length,
    };
  }, [partido, filtros]);

  /* Las gráficas, cada una sin su propio filtro. */
  const paraDistancia = filtradas(["distancia"]);
  const paraEntre = filtradas(["entre"]);

  const porDistancia = DISTANCIAS.map((d) => ({
    clave: d,
    cuantas: paraDistancia.filter((f) => f.distancia === d).length,
  }));

  /** Cuántas faltas hubo con cada número de defensores por delante. */
  const porEntre = (() => {
    const cuenta = new Map<string, number>();

    for (const f of paraEntre) {
      const clave = LECTORES.entre(f);
      cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    }

    return [...cuenta.entries()]
      .map(([clave, cuantas]) => ({ clave, cuantas }))
      .sort((a, b) =>
        a.clave === "?" ? 1 : b.clave === "?" ? -1 : Number(a.clave) - Number(b.clave),
      );
  })();

  /** La barra de «Filtrando»: el lado y todo lo pinchado. */
  const chips: ChipFiltro[] = [
    ...(filtro === "todas"
      ? []
      : [
          {
            clave: "lado",
            rotulo: "Lado",
            valor: NOMBRE_LADO[filtro],
            onQuitar: () => setFiltro("todas"),
          },
        ]),
    ...Object.entries(filtros).flatMap(([dimension, valores]) =>
      valores.map((valor) => ({
        clave: `${dimension}|${valor}`,
        rotulo: ROTULO[dimension] ?? dimension,
        valor: dimension === "entre" && valor === "?" ? "sin contar" : valor,
        onQuitar: () => quita(dimension, valor),
      })),
    ),
  ];

  const quitaTodo = () => {
    limpia();
    setFiltro("todas");
    setResaltada(null);
  };

  /** Una celda pinchable de la tabla o de la lista. */
  const celda = (dimension: string, valor: string, texto: string = valor) =>
    valor ? (
      <Filtrable
        activo={estaActivo(filtros, dimension, valor)}
        onClick={() => alterna(dimension, valor)}
      >
        {texto}
      </Filtrable>
    ) : (
      "—"
    );

  /** La media de defensores entre la falta y la portería que se ataca. */
  const defensores = useMemo(() => {
    const con = faltas.filter((f) => f.entre !== null).map((f) => f.entre as number);

    if (con.length === 0) return null;

    const suma = con.reduce((a, b) => a + b, 0);

    return {
      media: suma / con.length,
      minimo: Math.min(...con),
      maximo: Math.max(...con),
      contadas: con.length,
      sinContar: faltas.length - con.length,
    };
  }, [faltas]);

  /*
  | Las que se pitaron con el campo abierto: ésas cortaron algo.
  |
  | Sólo lejos del área que se ataca. Una falta lateral junto al área, o un
  | penalti, deja casi siempre a uno o dos defensores «por detrás» del balón
  | —se cuentan en profundidad, contra la línea de fondo— y no es una
  | transición cortada: es un balón parado. Metidas aquí, la lista se llenaba
  | de centros laterales.
  */
  const cortes = useMemo(
    () =>
      faltas
        .filter((f) => f.zona !== "campo rival")
        .filter((f) => f.entre !== null && (f.entre as number) <= CORTE_TRANSICION)
        .sort((a, b) => (a.entre as number) - (b.entre as number)),
    [faltas],
  );

  /*
  | Lo que dice lo que se está viendo (partido y filtro), en pocas frases.
  | La zona va hacia la portería que ataca quien saca: «campo rival» es
  | siempre el último tercio del que la saca.
  */
  const conclusiones = useMemo(() => {
    const total = faltas.length;

    if (total === 0) return [];

    const frases: string[] = [];

    /* Con algo pinchado, la primera frase lo dice: si no, parece el partido entero. */
    const conFiltro = Object.keys(filtros).length > 0 ? " con este filtro" : "";

    frases.push(
      filtro === "todas"
        ? `${porLado.ofensivo} a favor y ${porLado.defensivo} en contra${conFiltro}.`
        : `${total} ${total === 1 ? "falta" : "faltas"} ${filtro === "ofensivo" ? "a favor" : "en contra"}${conFiltro}.`,
    );

    /* La zona y el carril, en el campo de verdad (el Castilla atacando hacia la derecha). */
    const zona = laQueMas(faltas.map((f) => sitioEnCampo(f).zona));
    const carril = laQueMas(faltas.map((f) => sitioEnCampo(f).carril));

    const nombreZona = (z: string) => z;

    if (zona && carril) {
      frases.push(
        `Se concentran en ${nombreZona(zona.clave)} (${zona.veces}) y ${carril.clave === "centro" ? "por el centro" : `por la ${carril.clave}`} (${carril.veces}).`,
      );
    }

    const ultimoTercio = faltas.filter((f) => f.zona === "campo rival").length;
    const frontales = faltas.filter((f) => f.distancia === "frontal").length;

    if (ultimoTercio || frontales) {
      const donde =
        filtro === "ofensivo"
          ? "en campo rival"
          : filtro === "defensivo"
            ? "cerca de nuestra área"
            : "en último tercio";

      frases.push(
        `${ultimoTercio} ${donde}; ${frontales} ${frontales === 1 ? "frontal" : "frontales"}.`,
      );
    }

    if (defensores) {
      frases.push(
        `${decimal(defensores.media)} defensores por delante de media (de ${defensores.minimo} a ${defensores.maximo}).`,
      );
    }

    frases.push(
      cortes.length
        ? `${cortes.length} ${cortes.length === 1 ? "cortó" : "cortaron"} una transición con el campo abierto.`
        : "Ninguna cortó una transición: siempre con bloque hecho.",
    );

    return frases;
  }, [faltas, filtro, filtros, porLado, defensores, cortes]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Competición"
              title="Análisis de faltas"
              lead={
                explicativos
                  ? "Dónde se comete cada falta y cuánta gente defendía entre ella y la portería. Sale de ver el partido falta a falta."
                  : undefined
              }
            />

            {PARTIDOS.length === 0 || (partido?.faltas.length ?? 0) === 0 ? (
              <div className="mt-5">
                <Panel title="Todavía no hay ninguna falta etiquetada" icon={Crosshair}>
                  <Explicativo>
                    <p className="text-sm text-white/50">
                      Prepara una carpeta de clips y etiquétala: abajo están las
                      órdenes, con la carpeta que quieras.
                    </p>
                  </Explicativo>
                </Panel>
              </div>
            ) : null}

            {/* ---------------- el partido ---------------- */}

            {partido && (
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
                  {partido.jornada}
                </span>

                <span className="text-sm font-semibold text-white">
                  {partido.local
                    ? `RM Castilla · ${partido.rival}`
                    : `${partido.rival} · RM Castilla`}
                </span>

                <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[12px] tabular-nums text-white/80">
                  {partido.resultado}
                </span>

                <span className="text-[11px] uppercase tracking-[0.12em] text-white/35">
                  {partido.local ? "en casa" : "fuera"} · {fechaCorta(partido.fecha)}
                </span>

                <span className="ml-auto flex flex-wrap items-center gap-2 text-[11px]">
                  {(["ofensivo", "defensivo"] as const).map((lado) => (
                    <button
                      key={lado}
                      type="button"
                      onClick={() => alternaLado(lado)}
                      aria-pressed={filtro === lado}
                      title={TITULO_FILTRO}
                      className="cursor-pointer rounded-full px-2.5 py-1 transition hover:opacity-100"
                      style={{
                        color: TINTA_LADO[lado],
                        background: `${TINTA_LADO[lado]}1A`,
                        ...marcaPieza(filtro === lado, filtro !== "todas"),
                      }}
                    >
                      {porLado[lado]} {lado === "ofensivo" ? "a favor" : "en contra"}
                    </button>
                  ))}
                </span>
              </div>
            )}

            {/* ---------------- mandos ---------------- */}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {partidosVisibles.length > 1 && (
                <select
                  value={partido?.id ?? ""}
                  onChange={(e) => {
                    setPartidoId(e.target.value);
                    setResaltada(null);
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
                >
                  {partidosVisibles.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#11161C]">
                      {p.jornada} · {p.rival}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
                {(
                  [
                    { key: "todas" as const, label: "Todas" },
                    { key: "ofensivo" as const, label: "A favor" },
                    { key: "defensivo" as const, label: "En contra" },
                  ] satisfies { key: Filtro; label: string }[]
                ).map((uno) => (
                  <button
                    key={uno.key}
                    type="button"
                    onClick={() => {
                      setFiltro(uno.key);
                      setResaltada(null);
                    }}
                    aria-pressed={filtro === uno.key}
                    className={`rounded-lg px-3 py-2 text-xs transition ${
                      filtro === uno.key
                        ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    {uno.label}
                  </button>
                ))}
              </div>

              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/50">
                {faltas.length} {faltas.length === 1 ? "falta" : "faltas"}
              </span>
            </div>

            <BarraFiltros
              chips={chips}
              onLimpiar={quitaTodo}
              pretemporada={
                HAY_PRETEMPORADA
                  ? { incluida: conPretemporada, onCambiar: setConPretemporada }
                  : undefined
              }
              className="mt-3"
            />

            {partido?.notas.length ? (
              <Explicativo>
                <ul className="mt-3 space-y-1 text-[12px] text-white/40">
                  {partido.notas.map((nota) => (
                    <li key={nota}>· {nota}</li>
                  ))}
                </ul>
              </Explicativo>
            ) : null}

            <Conclusiones items={conclusiones} className="mt-4" />

            {/* ---------------- el campo ---------------- */}

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
              <Panel
                title="Dónde se cometen"
                subtitle={
                  explicativos
                    ? "Cada punto es una falta, en su tercio y su carril del campo de verdad: el Castilla ataca hacia la derecha, también en las faltas que saca el rival. El etiquetado guarda zonas, no metros: dentro de cada zona los puntos se reparten para no taparse"
                    : undefined
                }
                icon={Crosshair}
              >
                <CampoFaltas
                  faltas={paraCampo}
                  zonas={ZONAS_CAMPO}
                  carriles={CARRILES_CAMPO}
                  tinta={TINTA_LADO}
                  resaltada={resaltada}
                  onResaltar={setResaltada}
                  zonasMarcadas={filtros.zona ?? []}
                  carrilesMarcados={filtros.carril ?? []}
                  ladoMarcado={filtro === "todas" ? null : filtro}
                  onCajon={(zona, carril) =>
                    alternaVarios([
                      ["zona", zona],
                      ["carril", carril],
                    ])
                  }
                  onZona={(zona) => alterna("zona", zona)}
                  onCarril={(carril) => alterna("carril", carril)}
                  onLado={alternaLado}
                />

                {sinSitio > 0 && (
                  <p className="mt-3 text-[11px] text-white/35">
                    {sinSitio}{" "}
                    {sinSitio === 1
                      ? "falta no se pudo situar"
                      : "faltas no se pudieron situar"}{" "}
                    en el campo y no salen dibujadas.
                  </p>
                )}
              </Panel>

              <div className="space-y-4">
                <Panel title="Cuánta gente defendía" icon={Shield}>
                  {defensores ? (
                    <>
                      <div className="flex items-end gap-2">
                        <span className="text-4xl font-semibold text-[#C8A96B]">
                          {decimal(defensores.media)}
                        </span>

                        <span className="pb-1 text-sm text-white/45">
                          de media entre la falta y la portería, portero incluido
                        </span>
                      </div>

                      <p className="mt-2 text-[12px] text-white/40">
                        Entre {defensores.minimo} y {defensores.maximo}, contados en{" "}
                        {defensores.contadas} de {faltas.length}
                        {defensores.sinContar > 0
                          ? `. En ${defensores.sinContar} no se veía el campo entero.`
                          : "."}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-white/45">
                      Todavía no se ha podido contar en ninguna.
                    </p>
                  )}

                  {/*
                    El reparto, número a número, y cada uno se pincha: con
                    «3» marcado, la pantalla entera es de las faltas con tres
                    defensores por delante.
                  */}
                  {porEntre.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {porEntre.map((e) => (
                        <Filtrable
                          key={e.clave}
                          variante="pieza"
                          activo={estaActivo(filtros, "entre", e.clave)}
                          atenuado={hayFiltro(filtros, "entre")}
                          onClick={() => alterna("entre", e.clave)}
                          titulo={`${e.cuantas} ${e.cuantas === 1 ? "falta" : "faltas"} con ${e.clave === "?" ? "los defensores sin contar" : `${e.clave} por delante`} · ${TITULO_FILTRO}`}
                          className="inline-flex items-baseline gap-1 rounded-lg bg-white/[0.04] px-2 py-1 text-[12px]"
                        >
                          <span className="font-semibold text-white">{e.clave}</span>
                          <span className="text-white/40">×{e.cuantas}</span>
                        </Filtrable>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel
                  title="Faltas que cortaron algo"
                  subtitle={
                    explicativos
                      ? `Con ${CORTE_TRANSICION} defensores o menos por delante, fuera del último tercio: campo abierto`
                      : undefined
                  }
                  icon={Zap}
                >
                  {cortes.length === 0 ? (
                    <p className="text-sm text-white/45">
                      Ninguna con el campo abierto: todas se pitaron con el bloque
                      hecho.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {cortes.map((f) => (
                        <li
                          key={f.clip}
                          onMouseEnter={() => setResaltada(f.clip)}
                          onMouseLeave={() => setResaltada(null)}
                          className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 transition ${
                            resaltada === f.clip
                              ? "border-[#C8A96B]/50 bg-[#C8A96B]/[0.07]"
                              : "border-white/[0.06]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => alterna("entre", LECTORES.entre(f))}
                            aria-pressed={estaActivo(filtros, "entre", LECTORES.entre(f))}
                            title={TITULO_FILTRO}
                            className="mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-[11px] font-bold text-[#0B0F14]"
                            style={{
                              background: TINTA_LADO[f.lado],
                              ...(estaActivo(filtros, "entre", LECTORES.entre(f))
                                ? marcaPieza(true, true)
                                : {}),
                            }}
                          >
                            {f.entre}
                          </button>

                          <span className="min-w-0 text-[12px] leading-relaxed text-white/55">
                            <span className="text-white/45">{minutoDe(f)}</span>
                            {" · "}
                            <Filtrable
                              activo={filtro === f.lado}
                              onClick={() => alternaLado(f.lado)}
                              className="text-white/80"
                            >
                              {NOMBRE_LADO[f.lado]}
                            </Filtrable>
                            {" · "}
                            {celda("zona", sitioEnCampo(f).zona)}
                            {f.carril ? <> · {celda("carril", sitioEnCampo(f).carril)}</> : null}
                            {f.distancia ? <> · {celda("distancia", f.distancia)}</> : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title="A qué distancia" subtitle="De la portería que ataca quien la saca" icon={Swords}>
                  <div className="space-y-2">
                    {porDistancia.map((d) => (
                      <button
                        key={d.clave}
                        type="button"
                        onClick={() => alterna("distancia", d.clave)}
                        aria-pressed={estaActivo(filtros, "distancia", d.clave)}
                        title={TITULO_FILTRO}
                        style={marcaPieza(
                          estaActivo(filtros, "distancia", d.clave),
                          hayFiltro(filtros, "distancia"),
                        )}
                        className="flex w-full cursor-pointer items-center gap-3 rounded-md text-left transition hover:opacity-100"
                      >
                        <span className="w-16 text-[11px] uppercase tracking-[0.12em] text-white/40">
                          {d.clave}
                        </span>

                        <span className="block h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <span
                            className="block h-full rounded-full bg-[#C8A96B]"
                            style={{
                              width: `${paraDistancia.length ? (d.cuantas / paraDistancia.length) * 100 : 0}%`,
                            }}
                          />
                        </span>

                        <span className="w-6 text-right text-sm text-white">
                          {d.cuantas}
                        </span>
                      </button>
                    ))}
                  </div>
                </Panel>
              </div>
            </div>

            {/* ---------------- una por una ---------------- */}

            {faltas.length > 0 && (
              <div className="mt-4">
                <Panel
                  title="Una por una"
                  subtitle={
                    explicativos
                      ? "En el orden en que se dieron. Pasa por encima de una fila y se enciende su punto en el campo; pincha un valor y filtra la pantalla"
                      : undefined
                  }
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                        <tr>
                          <th className="pb-2 pr-3 font-medium">#</th>
                          <th className="pb-2 pr-3 font-medium">Lado</th>
                          <th className="pb-2 pr-3 font-medium">Dónde</th>
                          <th className="pb-2 pr-3 font-medium">Distancia</th>
                          <th className="pb-2 pr-3 font-medium">Defendían</th>
                          {/* El minuto va siempre: es lo que hace falta para ir al vídeo. */}
                          <th className="pb-2 pr-3 font-medium">Min.</th>
                          {/* «Qué pasó» explica la jugada: sólo con los textos explicativos encendidos. */}
                          {explicativos && <th className="pb-2 font-medium">Qué pasó</th>}
                        </tr>
                      </thead>

                      <tbody className="align-top">
                        {faltas.map((f, indice) => (
                          <tr
                            key={f.clip}
                            onMouseEnter={() => setResaltada(f.clip)}
                            onMouseLeave={() => setResaltada(null)}
                            className={`border-t border-white/[0.06] transition ${
                              resaltada === f.clip ? "bg-[#C8A96B]/[0.07]" : ""
                            }`}
                          >
                            <td className="py-2 pr-3 font-mono text-[12px] tabular-nums text-white/35">
                              {String(indice + 1).padStart(2, "0")}
                            </td>

                            <td className="py-2 pr-3">
                              <button
                                type="button"
                                onClick={() => alternaLado(f.lado)}
                                aria-pressed={filtro === f.lado}
                                title={TITULO_FILTRO}
                                className="cursor-pointer whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                                style={{
                                  color: TINTA_LADO[f.lado],
                                  background: `${TINTA_LADO[f.lado]}1A`,
                                  ...(filtro === f.lado ? marcaPieza(true, true) : {}),
                                }}
                              >
                                {NOMBRE_LADO[f.lado]}
                              </button>
                            </td>

                            <td className="py-2 pr-3 text-white/70">
                              {celda("zona", sitioEnCampo(f).zona)}
                              {f.carril ? <> · {celda("carril", sitioEnCampo(f).carril)}</> : null}
                            </td>

                            <td className="py-2 pr-3 text-white/60">
                              {celda("distancia", f.distancia)}
                            </td>

                            <td className="py-2 pr-3 font-semibold text-white">
                              {celda("entre", LECTORES.entre(f))}
                            </td>

                            <td className="whitespace-nowrap py-2 pr-3 font-mono text-[12px] tabular-nums text-white/60">
                              {minutoDe(f)}
                            </td>

                            {explicativos && <td className="py-2 text-white/45">{f.nota}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            )}

            {/* ---------------- cómo se actualiza ---------------- */}

            <Explicativo>
              <div className="mt-4">
                <ComoActualizar carpetaPorDefecto={partido?.clips ?? ""} />
              </div>
            </Explicativo>
          </div>
        </section>
      </div>
    </main>
  );
}
