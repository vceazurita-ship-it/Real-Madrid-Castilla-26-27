"use client";

/**
 * MAPAS DE REMATE (09/11/2026): cada remate de `opta:remates` en su sitio,
 * con el tamaño por su xG y el color por cómo acabó.
 *
 * - `MapaRemates`: el dibujo y su resumen (xG por remate, a puerta, xGOT−xG).
 * - `RematesEquipo`: un equipo de la categoría, a favor o en contra, con
 *   filtros por situación, parte del cuerpo y jugador, y la tabla de quién
 *   remata. Va en la pestaña «Remates» (cualquier equipo) y en «Castilla».
 * - `RematesJugador`: los de un jugador, para su ficha.
 */

import { useEffect, useMemo, useState } from "react";

import { CampoOpta, SOBRE_CESPED } from "@/components/campo/CampoOpta";
import { CASTILLA_OPTA, num } from "@/lib/opta";
import { fechaCorta, type Fila } from "@/lib/opta-analisis";
import { urlVideoOpta } from "@/lib/opta-video";
import { cargaResumenesRfef, resumenDelPartido, urlResumen } from "@/lib/rivals/resumen-de-partido";
import type { ResumenRfef } from "@/lib/rivals/resumenes-rfef";
import { casaEquipo, CUERPO, MARCADOR, PRESION, resumenRemates, SITUACION, TIPO_REMATE, type Remate } from "@/lib/opta-eventos";

import { Botonera, Cifra, Elegir, Panel } from "./comun";
import { GolesDeSeguido } from "./GolesDeSeguido";
import { conSigno, dec, equiposDe, nombreDe, pct, useRemates } from "./eventos";
import { useOpta, type DatosOpta } from "./useOpta";

const colorRemate = (r: Remate) => (r.gol ? SOBRE_CESPED.gol : r.tipo === "Post" ? SOBRE_CESPED.palo : r.aPuerta ? SOBRE_CESPED.puerta : "transparent");
const radio = (xG: number) => 7 + Math.sqrt(Math.max(0, xG)) * 40;

export function Leyenda() {
  const punto = (fondo: string, borde?: string) => (
    <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: fondo, boxShadow: borde ? `inset 0 0 0 1.5px ${borde}` : undefined }} />
  );
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/55">
      <span className="inline-flex items-center gap-1.5">{punto(SOBRE_CESPED.gol)}Gol</span>
      <span className="inline-flex items-center gap-1.5">{punto(SOBRE_CESPED.puerta)}A puerta (parado)</span>
      <span className="inline-flex items-center gap-1.5">{punto(SOBRE_CESPED.palo)}Al palo</span>
      <span className="inline-flex items-center gap-1.5">{punto("transparent", "rgb(var(--rmcf-ink-rgb) / 0.5)")}Fuera o bloqueado</span>
      <span>El tamaño, el xG del remate.</span>
    </p>
  );
}

/** Con qué comparar los remates de un partido: la media del equipo en el resto de la temporada (xG por remate y, por partido, xG y remates). */
export type RefRemates = { valor: number; partidos: number; xgPartido?: number; rematesPartido?: number };

/*
| 17/11/2026 (ronda 19, post del partido): la lectura corta de los remates de
| un equipo. Tres cifras y, debajo, tres barras en la misma escala con una
| frase que dice qué significa el signo. En el móvil, sólo la frase.
*/
function LecturaRemates({
  visibles,
  r,
  enContra,
  rotuloGoles,
  referencia,
}: {
  visibles: Remate[];
  r: ReturnType<typeof resumenRemates>;
  enContra: boolean;
  rotuloGoles?: string;
  referencia: RefRemates | null;
}) {
  const aPuerta = visibles.filter((x) => x.aPuerta);
  const xgot = aPuerta.reduce((s, x) => s + x.xGOT, 0);
  const tope = Math.max(r.xG, xgot, r.goles, 0.5);
  /*
  | 17/11/2026 (ronda 21, fútbol): una sola cuenta, la de las tres barras de
  | debajo: los goles esperados de TODOS los remates (xG) frente a lo que
  | valían tras el golpeo (xGOT, que sólo tienen los que van a puerta). La
  | diferencia es de dónde sale el signo; y, en contra, lo que valían a puerta
  | menos los goles encajados son los goles que evitó el portero. Antes el
  | «+0,7» se calculaba sólo con los tiros a puerta y no se veía de dónde salía.
  */
  /* 18/11/2026 (ronda 22, guionista): las cuentas, con las cifras ya redondeadas a un decimal; «0,5 bajaron a 0,3 (−0,1)» no cuadraba. */
  const red = (v: number) => Math.round(v * 10) / 10;
  const cambio = red(xgot) - red(r.xG);
  const uno = r.aPuerta === 1;
  const verbo = (nos: boolean) =>
    Math.abs(cambio) < 0.05
      ? `se quedaron en ${dec(xgot, 1)} tras el golpeo (${nos ? "rematamos" : "remataron"} como valía la ocasión)`
      : `${cambio > 0 ? "subieron" : "bajaron"} a ${dec(xgot, 1)} tras el golpeo (${conSigno(cambio, 1)}: ${nos ? "rematamos" : "remataron"} ${cambio > 0 ? "mejor" : "peor"} colocado${cambio < 0 ? " o fuera" : ""})`;
  const evitados = red(xgot) - r.goles;
  const frase = !r.aPuerta
    ? ""
    : enContra
      ? `Sus ${dec(r.xG, 1)} de goles esperados ${verbo(false)} y nuestro portero ${
          r.goles === 0 ? `paró ${uno ? "el único" : `los ${r.aPuerta}`} a puerta` : `encajó ${r.goles} de ${r.aPuerta} a puerta`
        }: ${evitados >= 0 ? `${dec(evitados, 1)} goles evitados` : `${dec(-evitados, 1)} goles más de lo que valían`}.`
      : `Nuestros ${dec(r.xG, 1)} de goles esperados ${verbo(true)} y marcamos ${r.goles} de ${r.aPuerta} a puerta${
          r.goles - red(xgot) >= 0.05 ? `: ${dec(r.goles - red(xgot), 1)} por encima de lo que valían` : ""
        }.`;
  const barras: { rotulo: string; valor: number; texto: string; opacidad: number }[] = [
    { rotulo: "Valían las ocasiones (xG)", valor: r.xG, texto: dec(r.xG, 1), opacidad: 0.45 },
    { rotulo: "Valían a puerta, tras el golpeo", valor: xgot, texto: dec(xgot, 1), opacidad: 0.75 },
    { rotulo: enContra ? "Nos marcaron" : "Goles", valor: r.goles, texto: String(r.goles), opacidad: 1 },
  ];
  const color = enContra ? "#5B8DEF" : "#C8A96B";

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-3 gap-2">
        <Cifra rotulo="Remates" valor={String(r.remates)} detalle={r.pctPuerta != null ? `${r.aPuerta} a puerta` : undefined} />
        <Cifra rotulo={rotuloGoles ?? (enContra ? "Goles encajados" : "Goles")} valor={String(r.goles)} />
        {/* 18/11/2026 (ronda 22, fútbol): «xG por remate 0,04 · su media 0,11» no
            se distinguía; los goles esperados del partido con su base y la media
            de la temporada por partido («0,5 en 13 remates; temporada: 1,2 en 11»). */}
        <Cifra
          rotulo="Goles esperados"
          valor={dec(r.xG, 1)}
          detalle={[
            `en ${r.remates} ${r.remates === 1 ? "remate" : "remates"}`,
            referencia?.xgPartido != null && referencia.rematesPartido != null
              ? `temporada: ${dec(referencia.xgPartido, 1)} en ${dec(referencia.rematesPartido, 1)} por partido (${referencia.partidos} partidos${referencia.partidos < 15 ? ", tendencia" : ""})`
              : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      </div>
      {frase && (
        <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Remates mejor o peor colocados de lo que valían</p>
          <p className="mt-1 text-[13px] font-medium leading-snug text-white/85">{frase}</p>
          <div className="mt-2 hidden space-y-1.5 sm:block" role="img" aria-label={barras.map((b) => `${b.rotulo}: ${b.texto}`).join("; ")}>
            {barras.map((b) => (
              <div key={b.rotulo} className="grid grid-cols-[minmax(0,13rem)_1fr_2.5rem] items-center gap-2 text-[12px]">
                <span className="truncate text-white/65">{b.rotulo}</span>
                <span className="relative h-2.5 rounded-full bg-white/[0.06]">
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(b.valor / tope) * 100}%`, background: color, opacity: b.opacidad }} />
                </span>
                <span className="text-right font-semibold tabular-nums text-white/85">{b.texto}</span>
              </div>
            ))}
          </div>
          {r.partidos === 1 && <p className="mt-1.5 text-[11px] text-white/55">Un solo partido: tendencia.</p>}
        </div>
      )}
    </div>
  );
}

function textoRemate(r: Remate, conTirador = true) {
  return [
    `${r.minuto}′`,
    conTirador ? r.tirador : "",
    TIPO_REMATE[r.tipo] ?? r.tipo,
    `xG ${dec(r.xG)}`,
    r.aPuerta && r.xGOT > 0 ? `xGOT ${dec(r.xGOT)}` : "",
    CUERPO[r.cuerpo] ?? "",
    SITUACION[r.situacion] ?? "",
    r.presion ? `presión ${(PRESION[r.presion] ?? r.presion).toLowerCase()}` : "",
    r.asistente ? `pase de ${r.asistente}` : "",
    MARCADOR[r.marcador] ? MARCADOR[r.marcador].toLowerCase() : "",
    `${fechaCorta(r.fecha)} contra ${nombreDe(r.rivalId, r.rival)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function MapaRemates({
  remates,
  ariaLabel,
  conTirador = true,
  enContra = false,
  maxAlto = 440,
  soloGolesInicial = false,
  rotuloGoles,
  referenciaXgRemate,
  lectura = false,
}: {
  remates: Remate[];
  /**
   * 17/11/2026 (ronda 19, post del partido): tres cifras grandes y, en vez de
   * la tarjeta «Calidad del golpeo» con su párrafo, unas barras en la misma
   * escala (lo que valían las ocasiones, lo que valían a puerta tras el golpeo
   * y los goles) con una frase. Sólo donde se pasa; el resto, como estaba.
   */
  lectura?: boolean;
  /** 16/11/2026 (ronda 18): con qué comparar «xG por remate» de un partido (la media del equipo en el resto de la temporada). */
  referenciaXgRemate?: RefRemates | null;
  ariaLabel: string;
  /** El rótulo de la cifra de goles («Nos marcaron» en el post del partido). */
  rotuloGoles?: string;
  /** Abre con «Sólo goles» puesto (el campograma de /analisis-goles). */
  soloGolesInicial?: boolean;
  conTirador?: boolean;
  /** En contra, el tirador es del rival: el texto lo dice así. */
  enContra?: boolean;
  maxAlto?: number;
}) {
  const [elegido, setElegido] = useState<Remate | null>(null);
  /*
  | SÓLO LOS GOLES, DE UN PARTIDO O DE TODOS (16/11/2026, petición del
  | analista): el mismo campograma de remates con dos filtros —«Sólo goles» y
  | el partido— que van en todas partes donde sale el mapa (área Opta, ficha
  | del rival, post-partido). Al pinchar un gol, su lista y los botones para
  | abrir Opta ProVision o Wyscout con el partido y el minuto a mano.
  */
  const [soloGoles, setSoloGoles] = useState(soloGolesInicial);
  const [partido, setPartido] = useState("");
  const partidos = useMemo(() => {
    const m = new Map<string, { clave: string; fecha: string; nombre: string }>();
    for (const x of remates) {
      if (m.has(x.partido)) continue;
      const otro = enContra ? nombreDe(x.teamId, x.equipo) : nombreDe(x.rivalId, x.rival);
      m.set(x.partido, { clave: x.partido, fecha: x.fecha, nombre: `${fechaCorta(x.fecha)} · ${enContra ? "de" : "contra"} ${otro}` });
    }
    return [...m.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [remates, enContra]);
  const delPartido = partido && partidos.some((p) => p.clave === partido) ? partido : "";
  const visibles = useMemo(
    () => remates.filter((x) => (!soloGoles || x.gol) && (!delPartido || x.partido === delPartido)),
    [remates, soloGoles, delPartido],
  );
  const r = resumenRemates(visibles);
  /* Los grandes debajo y los goles encima: que ninguno tape a otro entero. */
  const orden = useMemo(() => [...visibles].sort((a, b) => Number(a.gol) - Number(b.gol) || b.xG - a.xG), [visibles]);
  const visto = elegido && visibles.includes(elegido) ? elegido : null;
  const goles = useMemo(() => visibles.filter((x) => x.gol).sort((a, b) => b.fecha.localeCompare(a.fecha) || a.minuto - b.minuto), [visibles]);

  return (
    <div className="min-w-0">
      {(remates.some((x) => x.gol) || partidos.length > 1) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Botonera
            etiqueta="Qué remates"
            valor={soloGoles ? "goles" : "todos"}
            alCambiar={(v) => {
              setSoloGoles(v === "goles");
              setElegido(null);
            }}
            opciones={[
              { clave: "todos", nombre: "Todos los remates" },
              { clave: "goles", nombre: enContra ? "Sólo goles encajados" : "Sólo goles" },
            ]}
          />
          {partidos.length > 1 && (
            <Elegir
              etiqueta="Partido"
              valor={delPartido}
              alCambiar={(v) => {
                setPartido(v);
                setElegido(null);
              }}
              opciones={[{ clave: "", nombre: `Todos (${partidos.length})` }, ...partidos.map((p) => ({ clave: p.clave, nombre: p.nombre }))]}
            />
          )}
        </div>
      )}
      {lectura ? (
        <LecturaRemates visibles={visibles} r={r} enContra={enContra} rotuloGoles={rotuloGoles} referencia={delPartido ? null : referenciaXgRemate ?? null} />
      ) : (
      <div className="grid gap-2 sm:grid-cols-4">
        {/* 10/11/2026: con un solo partido, «17,0 por partido» no decía nada. */}
        <Cifra rotulo="Remates" valor={String(r.remates)} detalle={r.partidos && r.partidos > 1 ? `${dec(r.remates / r.partidos, 1)} por partido` : undefined} />
        <Cifra rotulo={rotuloGoles ?? (enContra ? "Goles encajados" : "Goles")} valor={String(r.goles)} detalle={`xG ${dec(r.xG, 1)} · ${conSigno(r.golesMenosXG, 1)}`} />
        <Cifra
          rotulo="xG por remate"
          valor={dec(r.xGPorRemate)}
          detalle={[
            r.pctPuerta != null ? `${pct(r.pctPuerta)} a puerta` : "",
            referenciaXgRemate && !delPartido ? `su media, ${dec(referenciaXgRemate.valor)} (${referenciaXgRemate.partidos} partidos)` : "",
          ]
            .filter(Boolean)
            .join(" · ") || undefined}
        />
        {r.xGOTmenosXG != null && (
          /*
          | 16/11/2026 (expertos, ronda 17): «+0,7» con 0 goles no se entendía.
          | Lleva su base (cuántos a puerta de cuántos), y con un solo partido
          | se dice que es tendencia. Si fue en contra, con signo + y sin gol,
          | se lee: remates bien dirigidos que paró el portero.
          */
          <Cifra
            rotulo="Calidad del golpeo"
            valor={conSigno(r.xGOTmenosXG, 1)}
            /* 16/11/2026 (expertos, ronda 18): en contra y sin gol, «+0,7» se
               leía «nos golpean bien»; se dice de forma directa lo que valían
               sus tiros a puerta y que el portero los paró. */
            detalle={[
              enContra && r.goles === 0 && r.xGOTmenosXG >= 0.3 && r.aPuerta
                ? `sus ${r.aPuerta} ${r.aPuerta === 1 ? "tiro" : "tiros"} a puerta valían ${dec(visibles.filter((x) => x.aPuerta).reduce((s, x) => s + x.xGOT, 0), 1)} de xG tras el golpeo y el portero ${r.aPuerta === 1 ? "lo paró" : "los paró"}`
                : enContra
                  ? "xG de sus remates a puerta menos xG de sus remates: + es que remataron mejor de lo que valía la ocasión"
                  : "xG del remate a puerta menos xG del remate: + es buen golpeo",
              r.pctPuerta != null && r.remates ? `${r.aPuerta} a puerta de ${r.remates}` : "",
              r.partidos === 1 ? "un solo partido: tendencia" : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        )}
      </div>
      )}

      <div className="mt-3">
        <CampoOpta vertical mitad ariaLabel={ariaLabel} maxAlto={maxAlto}>
          {(p) =>
            orden.map((s, i) => {
              const [cx, cy] = p(s.x, s.y);
              const color = colorRemate(s);
              const marcado = visto === s;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={radio(s.xG)}
                  onClick={() => setElegido(marcado ? null : s)}
                  style={{
                    fill: color,
                    fillOpacity: s.gol ? 0.95 : 0.7,
                    stroke: marcado ? "#FFFFFF" : color === "transparent" ? SOBRE_CESPED.fuera : "rgba(0,0,0,0.45)",
                    strokeWidth: marcado ? 5 : 2.5,
                    cursor: "pointer",
                  }}
                >
                  <title>{textoRemate(s, conTirador)}</title>
                </circle>
              );
            })
          }
        </CampoOpta>
      </div>
      <Leyenda />
      {visto && (
        <div className="mt-1.5 space-y-1.5">
          <p className="text-[12px] text-white/75">{textoRemate(visto, conTirador)}</p>
          <EnlacesVideo remate={visto} enContra={enContra} />
        </div>
      )}

      {/* Con «Sólo goles», la lista de los goles: pinchar uno lo marca en el campo y da sus enlaces. */}
      {soloGoles && goles.length > 0 && (
        <ol className="mt-3 space-y-1 text-[12px]">
          {goles.map((g, i) => (
            <li key={`${g.partido}-${g.segundo}-${i}`}>
              <button
                type="button"
                onClick={() => setElegido(visto === g ? null : g)}
                className={`flex w-full min-w-0 flex-wrap items-baseline gap-x-2 rounded-lg px-2 py-1 text-left transition hover:bg-white/[0.05] ${visto === g ? "bg-white/[0.07]" : ""}`}
              >
                <span className="font-semibold tabular-nums text-[#C8A96B]">{g.minuto}′</span>
                {conTirador && <span className="font-semibold text-white/85">{g.tirador}</span>}
                <span className="text-white/55">
                  {[TIPO_REMATE[g.tipo] ?? g.tipo, SITUACION[g.situacion] ?? "", `xG ${dec(g.xG)}`, `${fechaCorta(g.fecha)} ${enContra ? "de" : "contra"} ${enContra ? nombreDe(g.teamId, g.equipo) : nombreDe(g.rivalId, g.rival)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * LOS GOLES EN EL CAMPO (16/11/2026, petición del analista, para
 * /analisis-goles): los goles a favor o en contra de cualquier equipo de la
 * categoría, de un partido o de todos, en el mismo campograma que los
 * remates, con el vídeo a mano en Opta o Wyscout. El equipo llega por nombre
 * y se casa con Opta por `casaEquipo`.
 */
export function GolesEnElCampo({ equipo, esCastilla, ladoInicial = "favor" }: { equipo: string; esCastilla: boolean; ladoInicial?: Lado }) {
  const { datos } = useOpta();

  if (!datos) return <div className="h-64 animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label="Cargando los goles de Opta" />;

  return <GolesDelEquipo datos={datos} equipo={equipo} esCastilla={esCastilla} ladoInicial={ladoInicial} />;
}

function GolesDelEquipo({ datos, equipo, esCastilla, ladoInicial }: { datos: DatosOpta; equipo: string; esCastilla: boolean; ladoInicial: Lado }) {
  const { remates, cargando, hay } = useRemates(datos);
  const [lado, setLado] = useState<Lado>(ladoInicial);
  const teamId = useMemo(() => {
    if (!datos.equipos.length) return "";
    if (esCastilla) return CASTILLA_OPTA;
    return casaEquipo(equipo, equiposDe(datos)) ?? "";
  }, [datos, equipo, esCastilla]);
  const delLado = useMemo(() => remates.filter((r) => (lado === "favor" ? r.teamId === teamId : r.rivalId === teamId)), [remates, teamId, lado]);
  /* Memorizado: una lista nueva en cada pintado rehacía las tomas y volvía a cargar el corte que se estaba viendo. */
  const golesDelLado = useMemo(() => delLado.filter((r) => r.gol), [delLado]);

  if (cargando)
    return <div className="h-64 animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label="Cargando los goles de Opta" />;
  if (!hay || !teamId) return null;

  return (
    <div className="min-w-0">
      <div className="mb-3">
        <Botonera
          etiqueta="A favor o en contra"
          valor={lado}
          alCambiar={setLado}
          opciones={[
            { clave: "favor", nombre: "Goles a favor" },
            { clave: "contra", nombre: "Goles en contra" },
          ]}
        />
      </div>
      <GolesDeSeguido
        key={`seguido-${teamId}-${lado}`}
        goles={golesDelLado}
        titulo={`Goles ${lado === "favor" ? "de" : "contra"} ${equipo}`}
      />
      <MapaRemates
        key={`${teamId}-${lado}`}
        remates={delLado}
        enContra={lado === "contra"}
        soloGolesInicial
        ariaLabel={`Goles ${lado === "favor" ? "de" : "contra"} ${equipo} en el campo`}
      />
    </div>
  );
}

/** Opta ProVision (TruMedia) del club y la plataforma de Wyscout. */
const URL_OPTA = "https://realmadrid.opta.trumediasports.com/";
const URL_WYSCOUT = "https://wyscout.hudl.com/app/";

/*
| EL VÍDEO DEL REMATE (16/11/2026). Ni Opta ProVision ni Wyscout dejan enlazar
| un clip: Wyscout no tiene rutas (siempre /app/) y fabrica cada clip al
| vuelo (ver memoria wyscout-descarga-liga). Lo que sí se puede: abrir la
| plataforma en otra pestaña con el partido y el minuto ya copiados al
| portapapeles, para pegarlos en su buscador.
*/
function EnlacesVideo({ remate, enContra }: { remate: Remate; enContra: boolean }) {
  const [copiado, setCopiado] = useState(false);
  /* El resumen oficial de la RFEF de ese partido (16/11/2026): ahí salen sus goles. */
  const [resumenes, setResumenes] = useState<ResumenRfef[]>([]);

  useEffect(() => {
    let cancelado = false;

    cargaResumenesRfef().then((lista) => {
      if (!cancelado) setResumenes(lista);
    });

    return () => {
      cancelado = true;
    };
  }, []);

  /* El remate exacto en el Event Log de ProVision, con su vídeo abierto (16/11/2026). */
  const urlOpta = urlVideoOpta({ partido: remate.partido, fecha: remate.fecha, parte: remate.parte, segundo: remate.segundo }, "shots");
  const resumen = resumenDelPartido(resumenes, nombreDe(remate.teamId, remate.equipo), nombreDe(remate.rivalId, remate.rival), remate.fecha);
  const local = enContra ? nombreDe(remate.teamId, remate.equipo) : nombreDe(remate.rivalId, remate.rival);
  const nota = `${fechaCorta(remate.fecha)} · ${nombreDe(remate.teamId, remate.equipo)} contra ${nombreDe(remate.rivalId, remate.rival)} · ${remate.parte}.ª parte, minuto ${remate.minuto}′ · ${remate.tirador}`;
  const abre = (url: string) => {
    void navigator.clipboard?.writeText(nota).then(
      () => setCopiado(true),
      () => setCopiado(false),
    );
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const boton =
    "inline-flex items-center gap-1.5 rounded-lg border border-[#C8A96B]/40 px-2.5 py-1 text-[11px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/10";

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={`Vídeo del remate contra ${local}`}>
      {resumen && (
        <a
          href={urlResumen(resumen)}
          target="_blank"
          rel="noopener noreferrer"
          className={boton}
          title={`Resumen oficial de la RFEF: ${resumen.local} ${resumen.golesLocal}-${resumen.golesVisitante} ${resumen.visitante}, jornada ${resumen.jornada}. El gol es del minuto ${remate.minuto}′; el resumen no trae el segundo exacto.`}
        >
          ▶ Ver el resumen (YouTube)
        </a>
      )}
      {urlOpta ? (
        <a
          href={urlOpta}
          target="_blank"
          rel="noopener noreferrer"
          className={boton}
          title={`Abre en Opta ProVision este remate (${remate.parte}.ª parte, ${remate.minuto}′, ${remate.tirador}) con su vídeo, 8 s antes y 8 s después. Hace falta la sesión de Opta abierta.`}
        >
          ▶ Ver en Opta
        </a>
      ) : (
        <button type="button" onClick={() => abre(URL_OPTA)} className={boton} title={`Abre Opta ProVision y copia: ${nota}`}>
          ▶ Ver en Opta
        </button>
      )}
      <button type="button" onClick={() => abre(URL_WYSCOUT)} className={boton} title={`Abre Wyscout y copia: ${nota}`}>
        ▶ Ver en Wyscout
      </button>
      <span className="text-[11px] text-white/50">{copiado ? "Partido y minuto copiados: pégalos en su buscador." : urlOpta ? "Opta abre el remate exacto; Wyscout, la plataforma con el minuto copiado." : "Abre la plataforma y copia el partido y el minuto."}</span>
    </div>
  );
}

type Situacion = "todas" | "juego" | "abp" | "penalti";
const SITUACIONES: { clave: Situacion; nombre: string }[] = [
  { clave: "todas", nombre: "Todas" },
  { clave: "juego", nombre: "Juego" },
  { clave: "abp", nombre: "Balón parado" },
  { clave: "penalti", nombre: "Penaltis" },
];
const enSituacion = (r: Remate, s: Situacion) =>
  s === "todas" ||
  (s === "penalti" ? r.situacion === "Penalty" : s === "juego" ? r.situacion === "Open play" || r.situacion === "Fastbreak/Counter" : r.situacion !== "Penalty" && r.situacion !== "Open play" && r.situacion !== "Fastbreak/Counter");

type Cuerpo = "todos" | "pie" | "cabeza";
const CUERPOS: { clave: Cuerpo; nombre: string }[] = [
  { clave: "todos", nombre: "Todos" },
  { clave: "pie", nombre: "Con el pie" },
  { clave: "cabeza", nombre: "De cabeza" },
];

type Lado = "favor" | "contra";

/* Por id: en «en contra» rematan jugadores de veinte equipos y dos pueden llamarse igual. */
const claveTirador = (r: Remate) => r.tiradorId || r.tirador;

export function RematesEquipo({
  datos,
  teamId: fijo,
  titulo,
  inicial,
  alElegir,
}: {
  datos: DatosOpta;
  teamId?: string;
  titulo?: string;
  inicial?: string;
  /** 10/11/2026: el equipo elegido, para que la lectura de al lado abra con él. */
  alElegir?: (nombre: string) => void;
}) {
  const { remates, cargando, hay } = useRemates(datos);
  const equipos = useMemo(() => equiposDe(datos), [datos]);
  const [elegidoEquipo, setEquipo] = useState<string | null>(null);
  const teamId = fijo ?? elegidoEquipo ?? inicial ?? CASTILLA_OPTA;
  const [lado, setLado] = useState<Lado>("favor");
  const [situacion, setSituacion] = useState<Situacion>("todas");
  const [cuerpo, setCuerpo] = useState<Cuerpo>("todos");
  const [jugador, setJugador] = useState("");

  const delLado = useMemo(() => remates.filter((r) => (lado === "favor" ? r.teamId === teamId : r.rivalId === teamId)), [remates, teamId, lado]);
  const filtrados = useMemo(
    () =>
      delLado.filter(
        (r) =>
          enSituacion(r, situacion) &&
          (cuerpo === "todos" || (cuerpo === "cabeza" ? r.cuerpo === "Head" : r.cuerpo !== "Head")) &&
          (!jugador || claveTirador(r) === jugador),
      ),
    [delLado, situacion, cuerpo, jugador],
  );

  const tiradores = useMemo(() => {
    const m = new Map<string, Remate[]>();
    for (const r of delLado.filter((x) => enSituacion(x, situacion) && (cuerpo === "todos" || (cuerpo === "cabeza" ? x.cuerpo === "Head" : x.cuerpo !== "Head"))))
      m.set(claveTirador(r), [...(m.get(claveTirador(r)) ?? []), r]);
    return [...m.entries()]
      .map(([clave, rs]) => ({ clave, nombre: rs[0].tirador, ...resumenRemates(rs), equipo: lado === "contra" ? [...new Set(rs.map((x) => nombreDe(x.teamId, x.equipo)))].join(", ") : "" }))
      .sort((a, b) => b.xG - a.xG);
  }, [delLado, situacion, cuerpo, lado]);

  const nombre = nombreDe(teamId, equipos.find((e) => e.teamId === teamId)?.equipo ?? "");

  /* Los goles en propia puerta no son remates: sin ellos, el mapa se queda corto frente a los goles de la tabla (Castilla, Liga). */
  const filaEquipo = datos.equipos.find((f) => f.teamId === teamId);
  const oficiales = num(filaEquipo?.[lado === "favor" ? "Goal" : "GA"]);
  const enPropia = oficiales != null ? oficiales - delLado.filter((r) => r.gol).length : 0;

  if (cargando)
    return (
      <Panel titulo={titulo ?? "Mapa de remates"}>
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label="Cargando los remates" />
      </Panel>
    );
  if (!hay) return null;

  return (
    <Panel
      titulo={titulo ?? "Mapa de remates"}
      subtitulo={`${lado === "favor" ? `Los remates de ${nombre}` : `Los remates que le hacen a ${nombre}`} en la temporada, uno a uno (Opta). Pincha un punto para ver el remate.`}
      derecha={
        !fijo && (
          <Elegir
            etiqueta="Equipo"
            valor={teamId}
            alCambiar={(v) => {
              setEquipo(v);
              setJugador("");
              alElegir?.(equipos.find((e) => e.teamId === v)?.equipo ?? "");
            }}
            opciones={equipos.map((e) => ({ clave: e.teamId, nombre: e.equipo }))}
          />
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Botonera
          etiqueta="A favor o en contra"
          valor={lado}
          alCambiar={(v) => {
            setLado(v);
            setJugador("");
          }}
          opciones={[
            { clave: "favor", nombre: "A favor" },
            { clave: "contra", nombre: "En contra" },
          ]}
        />
        <Botonera etiqueta="Situación" valor={situacion} alCambiar={setSituacion} opciones={SITUACIONES} />
        <Botonera etiqueta="Parte del cuerpo" valor={cuerpo} alCambiar={setCuerpo} opciones={CUERPOS} />
        {jugador && (
          <button type="button" onClick={() => setJugador("")} className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white/75 hover:text-white">
            {delLado.find((r) => claveTirador(r) === jugador)?.tirador ?? ""} ✕
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <MapaRemates remates={filtrados} enContra={lado === "contra"} ariaLabel={`Mapa de remates ${lado === "favor" ? "de" : "contra"} ${nombre}`} />
          {enPropia > 0 && situacion === "todas" && cuerpo === "todos" && !jugador && (
            <p className="mt-1 text-xs text-white/50">
              {`${lado === "favor" ? "Le marcaron además" : "Encajó además"} ${enPropia === 1 ? "un gol" : `${enPropia} goles`} en propia puerta, que no ${
                enPropia === 1 ? "es un remate y no sale" : "son remates y no salen"
              } aquí: ${oficiales} ${lado === "favor" ? "a favor" : "en contra"} en total.`}
            </p>
          )}
        </div>

        {tiradores.length > 0 && (
          <div className="min-w-0 overflow-x-auto">
            <h3 className="mb-1.5 text-sm font-semibold text-white">{lado === "favor" ? "Quién remata" : "Quién le remata"}</h3>
            <table className="w-full min-w-[420px] text-left text-[12px] tabular-nums">
              <thead>
                <tr className="border-b border-white/10 text-xs text-white/55">
                  <th className="py-1.5 pr-2 font-semibold">Jugador</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Rem.</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Goles</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">xG</th>
                  <th className="py-1.5 pr-2 text-right font-semibold" title="xG por remate">xG/rem.</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">A puerta</th>
                  <th className="py-1.5 text-right font-semibold" title="xGOT − xG de sus remates a puerta">xGOT−xG</th>
                </tr>
              </thead>
              <tbody>
                {tiradores.slice(0, 15).map((t) => (
                  <tr
                    key={t.clave}
                    onClick={() => setJugador(jugador === t.clave ? "" : t.clave)}
                    className={`cursor-pointer border-b border-white/[0.06] hover:bg-white/[0.04] ${jugador === t.clave ? "bg-white/[0.06]" : ""}`}
                  >
                    <td className="max-w-[160px] truncate py-1.5 pr-2 text-white/85" title={t.equipo || undefined}>
                      {t.nombre}
                      {t.equipo && <span className="ml-1 text-xs text-white/45">{t.equipo}</span>}
                    </td>
                    <td className="py-1.5 pr-2 text-right text-white/75">{t.remates}</td>
                    <td className="py-1.5 pr-2 text-right text-white/75">{t.goles}</td>
                    <td className="py-1.5 pr-2 text-right text-white/75">{dec(t.xG)}</td>
                    <td className="py-1.5 pr-2 text-right text-white/75">{dec(t.xGPorRemate)}</td>
                    <td className="py-1.5 pr-2 text-right text-white/75">{pct(t.pctPuerta)}</td>
                    <td className="py-1.5 text-right text-white/75">{conSigno(t.xGOTmenosXG)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs leading-relaxed text-white/50">
              xG: la probabilidad de gol de cada ocasión antes del golpeo. xGOT: la misma tras el golpeo, sólo de los que van entre los palos; si xGOT − xG es positivo, el
              jugador coloca mejor de lo que la ocasión pedía.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}

/** Los remates de un jugador, para su ficha (cualquier jugador de la categoría). */
export function RematesJugador({ datos, jugador }: { datos: DatosOpta; jugador: Fila }) {
  const { remates } = useRemates(datos);
  const id = String(jugador.playerId ?? "");
  const suyos = useMemo(() => remates.filter((r) => r.tiradorId === id), [remates, id]);
  if (!suyos.length) return null;
  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <h3 className="mb-2 text-sm font-semibold text-white">Sus remates, uno a uno</h3>
      <MapaRemates remates={suyos} conTirador={false} ariaLabel={`Mapa de remates de ${String(jugador.jugador ?? "")}`} maxAlto={380} />
    </div>
  );
}
