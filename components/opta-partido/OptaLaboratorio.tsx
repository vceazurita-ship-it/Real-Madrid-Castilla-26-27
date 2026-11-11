"use client";

/**
 * OPTA EN EL LABORATORIO DE PARTIDO (10/11/2026): robos, pérdidas y faltas.
 *
 * Lo que da Opta y el vídeo no:
 *
 * 1. **El Castilla en su grupo**, por partido, con su puesto y su percentil
 *    (y el próximo rival al lado, si el calendario lo dice y Opta lo
 *    reconoce): recuperaciones y pérdidas por tercio, intercepciones, PPDA,
 *    faltas cometidas y recibidas.
 * 2. **El partido elegido según Opta.** En faltas es la misma cuenta que la
 *    etiquetada y va al lado; en robos y pérdidas NO lo es (ver
 *    `lib/opta-laboratorio.ts`): sus cifras van solas, con la diferencia
 *    explicada.
 * 3. **El mapa de Opta del partido** (`CampoOpta`), sólo si se pide: necesita
 *    `opta:castilla-eventos` (≈3 MB), que no se baja al abrir la pantalla.
 *
 * Sólo documentos ligeros al montar (`useOptaLigero`). Sin dato, no se
 * pinta nada.
 */

import { useMemo, useState } from "react";
import { Database, Map as MapIcon } from "lucide-react";

import { Panel } from "@/components/abp/ui";
import { BarraPercentil, LeyendaPercentil, type FilaPercentil } from "@/components/data/graficas";
import { CampoOpta, SOBRE_CESPED } from "@/components/campo/CampoOpta";
import { Explicativo } from "@/components/ui/textos-analisis";
import { useProximoRival } from "@/hooks/useAbpLigas";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { useOptaLigero, type OptaLigero } from "@/hooks/useOptaLigero";
import { CASTILLA_OPTA, DOCS_OPTA, aObjetos, type TablaOpta } from "@/lib/opta";
import { fechaCorta, nombreEquipo, type Fila, type PartidoEquipo } from "@/lib/opta-analisis";
import { accionesCastilla, esPerdida, esRecuperacion, type AccionCastilla } from "@/lib/opta-eventos";
import {
  METRICAS_LAB,
  cifra,
  contextoGrupo,
  equipoOptaDe,
  hastaElPartido,
  partidoOptaDe,
  type FilaLab,
  type ModoLab,
} from "@/lib/opta-laboratorio";
import { defMetrica } from "@/lib/opta-nombres";

export type PartidoLab = { rival: string; fecha: string; jornada: string };

const coma = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

/** «media 39,2» si se sabe. */
const mediaDe = (f: Fila | undefined, a: string, catalogo: OptaLigero["catalogo"]) => {
  if (!f) return null;
  const v = f[a];
  const gm = Number(f.GM);
  if (typeof v !== "number" || !gm) return null;
  return defMetrica(a, catalogo).tasa ? v : v / gm;
};

function aFila(x: FilaLab, catalogo: OptaLigero["catalogo"]): FilaPercentil {
  const def = defMetrica(x.a, catalogo);
  return {
    key: x.a,
    nombre: x.nombre,
    unidad: def.unidad === "entero" ? "decimal" : def.unidad,
    mejorAlto: x.mejor,
    valor: x.pos.valor,
    mediana: x.pos.mediana,
    percentil: x.pos.percentil,
    puesto: x.pos.puesto,
    deCuantos: x.pos.deCuantos,
    comoLeer: x.comoLeer,
  };
}

export function OptaLaboratorio({
  modo,
  partido,
  aMano,
  className = "mt-5",
}: {
  modo: ModoLab;
  /** El partido que se mira en la pantalla; null si se miran todos. */
  partido: PartidoLab | null;
  /** Sólo faltas (la misma cuenta que Opta): las etiquetadas de ese partido. */
  aMano?: { cometidas: number; recibidas: number } | null;
  className?: string;
}) {
  const { opta, cargando } = useOptaLigero();
  const proximo = useProximoRival();

  const castilla = useMemo(
    () => (opta ? contextoGrupo(opta.equipos, opta.grupos, CASTILLA_OPTA, METRICAS_LAB[modo], opta.catalogo) : []),
    [opta, modo],
  );
  const idRival = useMemo(() => (opta && proximo ? equipoOptaDe(proximo, opta.equipos) : null), [opta, proximo]);
  /* El próximo rival, sólo si es del mismo grupo: si no, su puesto sería de otra tabla. */
  const rival = useMemo(
    () =>
      opta && idRival && idRival !== CASTILLA_OPTA && opta.grupos.get(idRival) === opta.grupos.get(CASTILLA_OPTA)
        ? contextoGrupo(opta.equipos, opta.grupos, idRival, METRICAS_LAB[modo], opta.catalogo)
        : [],
    [opta, idRival, modo],
  );
  const nombreRival = useMemo(() => {
    const f = opta?.equipos.find((e) => e.teamId === idRival);
    return f ? nombreEquipo(f) : "";
  }, [opta, idRival]);

  const delPartido = useMemo(
    () => (opta && partido ? partidoOptaDe(opta.partidos, opta.equipos, partido.rival, partido.fecha) : null),
    [opta, partido],
  );

  if (cargando) {
    /* Reserva el sitio: que la pantalla no salte cuando llegue. */
    return <div className={`${className} h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]`} role="status" aria-label="Cargando las cifras de Opta" />;
  }
  if (!opta || !castilla.length) return null;

  const hasta = hastaElPartido(opta.meta, opta.partidos);
  const deCuantos = castilla[0]?.pos.deCuantos ?? 0;
  const titulo = modo === "robos" ? "Recuperar el balón" : modo === "perdidas" ? "Perder el balón" : "Faltas";

  return (
    <Panel
      title={`Opta · ${titulo}: el Castilla en su grupo`}
      subtitle={`Por partido, frente a los ${deCuantos} equipos del grupo («liga» = su mediana) · Opta${hasta ? ` · hasta el partido del ${hasta}` : ""}`}
      icon={Database}
      className={className}
    >
      <div className="mb-2">
        <LeyendaPercentil poblacion="el grupo" />
      </div>
      <div className="min-w-0">
        {castilla.map((x) => {
          const suya = rival.find((r) => r.a === x.a);
          return (
            <BarraPercentil
              key={x.a}
              fila={aFila(x, opta.catalogo)}
              otra={suya ? aFila(suya, opta.catalogo) : null}
              nombreOtra={suya ? `${nombreRival} (próximo rival)` : undefined}
            />
          );
        })}
      </div>
      {rival.length > 0 && (
        <p className="mt-2 text-[11px] text-white/50">
          En azul, {nombreRival}, el próximo rival: su cifra, su puesto y su marca en la barra.
        </p>
      )}

      {partido && delPartido && (
        <ElPartido modo={modo} partido={partido} opta={opta} delPartido={delPartido} aMano={aMano ?? null} />
      )}
    </Panel>
  );
}

/**
 * LAS DOS CIFRAS, LADO A LADO (10/11/2026): bajo el resumen de robos o de
 * pérdidas, la nuestra (vídeo) y la de Opta del mismo partido, con una línea
 * de por qué no coinciden. Antes se explicaba plegado arriba y la misma
 * cifra salía de dos formas sin decirlo.
 */
export function ContrasteOpta({ modo, partido, aqui }: { modo: "robos" | "perdidas"; partido: PartidoLab; aqui: number }) {
  const { opta } = useOptaLigero();
  const delPartido = useMemo(
    () => (opta ? partidoOptaDe(opta.partidos, opta.equipos, partido.rival, partido.fecha) : null),
    [opta, partido.rival, partido.fecha],
  );
  if (!delPartido) return null;
  const f = delPartido.fila;

  if (modo === "robos") {
    const rec = cifra(f, "Recovery");
    const int = cifra(f, "Int");
    if (rec == null) return null;
    return (
      <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] leading-relaxed text-white/70">
        <b className="text-white/85">Aquí, {aqui} robos</b> vistos en el vídeo (entrada, intercepción o balón ganado apretando). <b className="text-white/85">Opta, {rec} recuperaciones</b>
        {int != null ? ` y ${int} intercepciones aparte` : ""}: su recuperación es quedarse un balón suelto o uno que da el rival. No es la misma cuenta.
      </p>
    );
  }

  const total = cifra(f, "PossLost");
  const propio = cifra(f, "PsLostD3");
  if (total == null) return null;
  return (
    <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] leading-relaxed text-white/70">
      <b className="text-white/85">Aquí, {aqui} pérdidas</b>: todas las vistas en el vídeo, sólo el balón que teníamos y pasa al rival en juego. <b className="text-white/85">Opta, {total}</b>
      {propio != null ? ` (${propio} en nuestro tercio)` : ""}: suma cada pase que no llega, aunque salga fuera. Por eso no coinciden con Análisis de datos.
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  El partido elegido                                                 */
/* ------------------------------------------------------------------ */

function Casilla({ rotulo, valor, pie }: { rotulo: string; valor: string; pie?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{rotulo}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-white">{valor}</p>
      {pie ? <p className="mt-0.5 text-[11px] leading-snug text-white/55">{pie}</p> : null}
    </div>
  );
}

function ElPartido({
  modo,
  partido,
  opta,
  delPartido,
  aMano,
}: {
  modo: ModoLab;
  partido: PartidoLab;
  opta: OptaLigero;
  delPartido: PartidoEquipo;
  aMano: { cometidas: number; recibidas: number } | null;
}) {
  const [verMapa, setVerMapa] = useState(false);
  const f = delPartido.fila;
  const nuestra = opta.equipos.find((e) => e.teamId === CASTILLA_OPTA);
  const media = (a: string) => mediaDe(nuestra, a, opta.catalogo);
  /* 10/11/2026: los cocientes (PPDA) de la temporada no son una media de
     partidos, sino el cociente de las sumas: el pie lo dice así. */
  const pieMedia = (a: string) => {
    const m = media(a);
    if (m == null) return undefined;
    return defMetrica(a, opta.catalogo).tasa ? `temporada en conjunto ${coma(m)} (no es la media de los partidos)` : `media por partido de la temporada ${coma(m)}`;
  };
  const conPie = (que: string, a: string) => [que, pieMedia(a)].filter(Boolean).join(" · ");
  const cabecera = `${partido.jornada} · ${delPartido.rival} · ${fechaCorta(delPartido.fecha)}`;

  if (modo === "faltas") {
    const com = cifra(f, "FoulCom");
    const rec = cifra(f, "FoulSuf");
    if (com == null && rec == null) return null;
    const filas = [
      { nombre: "Cometidas (en contra)", mano: aMano?.cometidas ?? null, opta: com },
      { nombre: "Recibidas (a favor)", mano: aMano?.recibidas ?? null, opta: rec },
    ].filter((x) => x.opta != null);
    const cuadra = filas.every((x) => x.mano == null || x.mano === x.opta);
    return (
      <div className="mt-5 border-t border-white/10 pt-4">
        <h3 className="text-sm font-semibold text-white">El partido, a mano y en Opta</h3>
        <p className="text-[11px] text-white/50">{cabecera}</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[300px] text-left text-[13px] tabular-nums">
            <thead>
              <tr className="border-b border-white/10 text-[11px] text-white/50">
                <th className="py-1.5 pr-2 font-semibold">Faltas</th>
                {aMano ? <th className="py-1.5 pr-2 text-right font-semibold">A mano</th> : null}
                <th className="py-1.5 pr-2 text-right font-semibold">Opta</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((x) => (
                <tr key={x.nombre} className="border-b border-white/[0.06]">
                  <td className="py-1.5 pr-2 text-white/80">{x.nombre}</td>
                  {aMano ? <td className="py-1.5 pr-2 text-right text-white">{x.mano ?? ""}</td> : null}
                  <td className="py-1.5 pr-2 text-right text-white">{x.opta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-white/55">
          {aMano
            ? cuadra
              ? "Las dos fuentes cuentan lo mismo, las faltas pitadas, y aquí cuadran."
              : "Manda la lista de esta pantalla: cada falta vista y con su vídeo."
            : "Opta cuenta las faltas pitadas, lo mismo que se etiqueta aquí."}
        </p>
        {/* 11/11/2026 (experto de fútbol): el descuadre es trabajo del analista;
            sólo sale con los textos explicativos encendidos. */}
        {aMano && !cuadra ? (
          <Explicativo>
            <p className="mt-1 text-[11px] leading-relaxed text-white/45">
              Para revisar: {filas.filter((x) => x.mano != null && x.mano !== x.opta).map((x) => `${x.nombre.split(" (")[0].toLowerCase()}, ${x.mano} a mano y ${x.opta} en Opta`).join("; ")}.
            </p>
          </Explicativo>
        ) : null}
      </div>
    );
  }

  const robos = modo === "robos";
  const total = cifra(f, robos ? "Recovery" : "PossLost");
  if (total == null) return null;
  const tercios = robos
    ? [cifra(f, "PosWonD3rd"), cifra(f, "PosWonM3rd"), cifra(f, "PosWonA3rd")]
    : [cifra(f, "PsLostD3"), cifra(f, "PsLostM3"), cifra(f, "PsLostA3")];
  const extra = robos
    ? [
        { a: "Int", rotulo: "Intercepciones" },
        { a: "PPDA", rotulo: "PPDA" },
      ]
    : [{ a: "Disposs", rotulo: "Robados en conducción" }];

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <h3 className="text-sm font-semibold text-white">El partido según Opta</h3>
      <p className="text-[11px] text-white/50">{cabecera}</p>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {/* Lo que cuenta cada casilla, dicho: el mapa de abajo no cuenta lo mismo. */}
        <Casilla
          rotulo={robos ? "Recuperaciones" : "Pérdidas"}
          valor={String(total)}
          pie={
            robos
              ? conPie("balón suelto o que el rival da; sin intercepciones ni entradas", "Recovery")
              : conPie("recuento de Opta: todo pase que no llega, regate perdido o balón robado", "PossLost")
          }
        />
        {tercios.every((t) => t != null) && (
          <Casilla
            rotulo="Por tercios"
            valor={tercios.join(" · ")}
            pie="propio · medio · último"
          />
        )}
        {extra.map((x) => {
          const v = cifra(f, x.a);
          if (v == null) return null;
          return <Casilla key={x.a} rotulo={x.rotulo} valor={x.a === "PPDA" ? coma(v) : String(v)} pie={pieMedia(x.a)} />;
        })}
      </div>

      {/* 10/11/2026: plegada; la diferencia de cifras ya va dicha arriba en una línea. */}
      <details className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.05] px-3 py-2 text-[12px] leading-relaxed text-white/75">
        <summary className="cursor-pointer font-semibold text-white/85">¿Por qué Opta no cuenta lo mismo que esta pantalla?</summary>
        {robos ? (
          <p className="mt-0.5">
            Aquí se apunta cada robo activo del vídeo: entrada, intercepción o balón ganado apretando. La «recuperación» de Opta es otra cosa: quedarse un balón suelto o uno que
            el rival nos da; las intercepciones y las entradas ganadas las cuenta aparte. Por eso no se ponen una al lado de la otra.
          </p>
        ) : (
          <p className="mt-0.5">
            Aquí se apunta sólo el balón que teníamos y pasa a ser del rival con el balón en juego. Opta cuenta como pérdida cada pase que no llega a un compañero, cada regate
            perdido y cada balón robado, aunque salga del campo: por eso su cifra es mucho más alta y no se pone al lado de la nuestra.
          </p>
        )}
        <Explicativo>
          <p className="mt-1 text-white/55">
            Los tercios de Opta parten el campo en tres partes iguales hacia la portería rival, igual que la zona del etiquetado; lo que cambia es qué acción se cuenta.
          </p>
        </Explicativo>
      </details>

      {verMapa ? (
        <MapaOpta modo={modo} partidoOpta={String(f.partido ?? "")} />
      ) : (
        <button
          type="button"
          onClick={() => setVerMapa(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm text-white/80 transition hover:border-[#C8A96B]/40"
        >
          <MapIcon size={14} className="text-[#C8A96B]" />
          {robos ? "Ver en el campo dónde recuperamos, según Opta" : "Ver en el campo dónde perdemos, según Opta"}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  El mapa del partido                                                */
/* ------------------------------------------------------------------ */

const TIPOS: Record<"robos" | "perdidas", { clave: string; nombre: string; color: string; es: (a: AccionCastilla) => boolean }[]> = {
  robos: [
    { clave: "BallRecovery", nombre: "Recuperación (balón suelto)", color: SOBRE_CESPED.verde, es: (a) => a.tipo === "BallRecovery" },
    { clave: "Interception", nombre: "Intercepción", color: SOBRE_CESPED.puerta, es: (a) => a.tipo === "Interception" },
    { clave: "Tackle", nombre: "Entrada ganada", color: SOBRE_CESPED.gol, es: (a) => a.tipo === "Tackle" },
  ],
  perdidas: [
    { clave: "Pass", nombre: "Pase que no llega", color: SOBRE_CESPED.rival, es: (a) => a.tipo === "Pass" },
    { clave: "Dispossessed", nombre: "Robado en conducción", color: SOBRE_CESPED.palo, es: (a) => a.tipo === "Dispossessed" },
    { clave: "TakeOn", nombre: "Regate perdido", color: SOBRE_CESPED.gol, es: (a) => a.tipo === "TakeOn" },
  ],
};

function MapaOpta({ modo, partidoOpta }: { modo: "robos" | "perdidas"; partidoOpta: string }) {
  const { docs, cargando } = useDocsOpta<[TablaOpta, TablaOpta, TablaOpta]>(DOCS_OPTA.castillaEventos, DOCS_OPTA.castilla, DOCS_OPTA.castillaPartidos);
  const [eventos, plantilla, porPartido] = docs;
  const nuestros = useMemo(
    () => new Set([...aObjetos(plantilla), ...aObjetos(porPartido)].map((f) => String(f.playerId ?? "")).filter(Boolean)),
    [plantilla, porPartido],
  );
  const lista = useMemo(() => {
    const filtro = modo === "robos" ? esRecuperacion : esPerdida;
    return accionesCastilla(eventos, nuestros).filter((a) => a.partido === partidoOpta && a.nuestra && filtro(a));
  }, [eventos, nuestros, partidoOpta, modo]);

  if (cargando) {
    return <div className="mt-3 aspect-[105/68] max-h-[420px] w-full animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label="Cargando las acciones del partido en Opta" />;
  }
  if (!lista.length) return null;

  const tipos = TIPOS[modo].map((t) => ({ ...t, n: lista.filter(t.es).length })).filter((t) => t.n > 0);
  const cuantos = (clave: string) => tipos.find((t) => t.clave === clave)?.n ?? 0;
  const colorDe = (a: AccionCastilla) => TIPOS[modo].find((t) => t.es(a))?.color ?? SOBRE_CESPED.tenue;
  const porTercio = [lista.filter((a) => a.x < 33.3).length, lista.filter((a) => a.x >= 33.3 && a.x < 66.7).length, lista.filter((a) => a.x >= 66.7).length];

  return (
    <div className="mt-3 min-w-0">
      <p className="text-[11px] leading-relaxed text-white/55">
        {/* 10/11/2026: el mapa no cuenta lo mismo que la casilla de arriba, y se dice. */}
        {modo === "robos"
          ? `${lista.length} acciones con las que el Castilla se queda el balón: ${cuantos("BallRecovery")} recuperaciones de balón suelto (las de la casilla «Recuperaciones»), ${cuantos("Interception")} intercepciones y ${cuantos("Tackle")} entradas ganadas`
          : `${lista.length} acciones del registro evento a evento en las que el Castilla deja de tener el balón: pases que no llegan, regates perdidos y balones robados. No es la cifra de la casilla «Pérdidas»: ese es el recuento propio de Opta, que da por perdidas más acciones de las que el registro pone en el campo`}
        {`. Por tercios: ${porTercio.join(" · ")} (propio · medio · último). El Castilla ataca hacia la derecha.`}
      </p>
      <div className="mt-2 max-w-3xl">
        <CampoOpta ariaLabel={modo === "robos" ? "Dónde recupera el Castilla en el partido, según Opta" : "Dónde pierde el balón el Castilla en el partido, según Opta"} maxAlto={420}>
          {(p) => (
            <>
              {[33.3, 66.7].map((x) => {
                const [x1, y1] = p(x, 0);
                const [x2, y2] = p(x, 100);
                return <line key={x} x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: "rgba(242,201,76,0.35)", strokeWidth: 2, strokeDasharray: "10 10" }} />;
              })}
              {lista.map((a, i) => {
                const [cx, cy] = p(a.x, a.y);
                return (
                  <circle key={i} cx={cx} cy={cy} r={11} style={{ fill: colorDe(a), fillOpacity: 0.8, stroke: "rgba(0,0,0,0.45)", strokeWidth: 1.5 }}>
                    <title>{`${a.minuto}′ · ${a.jugador || "Castilla"} · ${TIPOS[modo].find((t) => t.es(a))?.nombre ?? a.tipo}`}</title>
                  </circle>
                );
              })}
            </>
          )}
        </CampoOpta>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/65">
        {tipos.map((t) => (
          <li key={t.clave} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
            {t.nombre} · {t.n}
          </li>
        ))}
      </ul>
      {modo === "robos" && (
        <Explicativo>
          <p className="mt-1 text-[11px] text-white/45">Opta no pone nombre a las recuperaciones de balón suelto: al pasar por encima sale «Castilla».</p>
        </Explicativo>
      )}
    </div>
  );
}
