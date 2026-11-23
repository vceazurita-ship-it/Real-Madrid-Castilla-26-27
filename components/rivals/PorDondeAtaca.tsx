"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { traeJson } from "@/lib/hojaCsv";
import { puestoEnPalabras } from "@/lib/posiciones";
import { puestoDelRival } from "@/lib/rivals/colocacion-once";
import { asignaPerfiles } from "@/lib/rivals/perfil-wyscout";
import { conRivalEnUrl } from "@/lib/rivals/rival-en-curso";
import { fichaRivalPath, playerKey } from "@/lib/rivals/once";
import { BANDAS, TIPOS_ACCION, type PorDondeAtaca as Datos } from "@/lib/rivals/por-donde-ataca";

/*
| «Por dónde ataca» (13/11/2026): sus centros, regates, pases al área y
| acciones progresivas repartidos entre las dos bandas y el centro según el
| puesto de cada jugador en Wyscout, y quién carga cada banda. El cálculo es
| de `lib/rivals/por-donde-ataca.ts` en el servidor; aquí se pinta y se casa
| cada nombre de Wyscout con su ficha de Plantillas rivales para enlazarla.
|
| Sin descarga de Wyscout para el rival no pinta nada.
*/

type Ficha = Record<string, unknown>;

const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

export function PorDondeAtaca({
  equipo,
  plantilla,
  compacto = false,
  rivalId = "",
}: {
  equipo: string;
  plantilla: Ficha[];
  /**
   * Una línea con el reparto y el enlace al bloque entero de Área del rival
   * (17/11/2026, ronda 19, jueces): el bloque salía idéntico en Scout colectivo
   * y en Área. Se queda entero en Área, que es la pantalla de las bandas.
   */
  compacto?: boolean;
  rivalId?: string;
}) {
  const [estado, setEstado] = useState<{ equipo: string; datos: Datos | null }>({ equipo: "", datos: null });

  useEffect(() => {
    if (!equipo) return;

    let cancelado = false;

    traeJson<{ ok?: boolean } & Partial<Datos>>(`/api/data-analisis?bandas=${encodeURIComponent(equipo)}`)
      .then((r) => {
        if (cancelado) return;

        const vale = r?.ok && Array.isArray(r.bandas) && r.total;

        setEstado({ equipo, datos: vale ? (r as Datos) : null });
      })
      .catch(() => {
        if (!cancelado) setEstado({ equipo, datos: null });
      });

    return () => {
      cancelado = true;
    };
  }, [equipo]);

  const datos = estado.equipo === equipo ? estado.datos : null;

  /* Cada nombre de Wyscout, su ficha: la plantilla entera a la vez, uno a uno. */
  const enlaces = useMemo(() => {
    const mapa = new Map<string, string>();
    const puestos = new Map<string, string>();

    if (!datos?.nombres?.length || !plantilla.length) return { mapa, puestos };

    const asignados = asignaPerfiles(
      plantilla,
      datos.nombres.map((jugador) => ({ jugador })),
      (f) => playerKey(f),
    );

    for (const ficha of plantilla) {
      const casado = asignados.get(playerKey(ficha));

      if (casado) {
        mapa.set(casado.jugador, fichaRivalPath(String(ficha.NOMBRE_EQUIPO ?? equipo), playerKey(ficha)));
        /* El puesto de su plantilla, el mismo de todas las pantallas (`puestoDelRival`, 16/11/2026). */
        const origen = puestoDelRival(String(ficha["POSICIÓN"] ?? "")).origen;
        if (origen) puestos.set(casado.jugador, origen);
      }
    }

    return { mapa, puestos };
  }, [datos, plantilla, equipo]);

  if (!datos) return null;

  const total = datos.total;
  const hayAlgo = TIPOS_ACCION.some((t) => total[t.key] > 0);

  if (!hayAlgo) return null;

  /* La banda que más carga: centros, regates y pases al área de las dos bandas juntas. */
  const deBanda = (b: "izquierda" | "derecha") => {
    const parte = datos.bandas.find((x) => x.banda === b);

    return parte ? parte.acciones.centros + parte.acciones.regates + parte.acciones.pasesArea : 0;
  };
  const izq = deBanda("izquierda");
  const der = deBanda("derecha");
  const parteIzq = pct(izq, izq + der);
  const dominante = izq + der === 0 ? null : parteIzq >= 58 ? "izquierda" : parteIzq <= 42 ? "derecha" : null;

  /* El jugador del que más depende una banda (por cualquier tipo), para el titular. */
  const carga = datos.bandas
    .filter((b) => b.banda !== "centro")
    .flatMap((b) =>
      TIPOS_ACCION.map((t) => ({ banda: b.banda, tipo: t, lider: b.lider[t.key] })).filter(
        (x) => x.lider && total[x.tipo.key] >= 10,
      ),
    )
    .map((x) => ({ ...x, parte: pct(x.lider!.acciones, total[x.tipo.key]) }))
    .sort((a, b) => b.parte - a.parte)[0];

  /* El reparto por carril, el mismo que dibuja el campo: con él se titula (17/11/2026, jueces de fútbol: la frase decía 48/52 y el gráfico 28/39/33). */
  const sumaDe = (key: string) => {
    const parte = datos.bandas.find((b) => b.banda === key);
    return parte ? TIPOS_ACCION.reduce((x, t) => x + parte.acciones[t.key], 0) : 0;
  };
  const carriles = BANDAS.map(({ key }) => ({ key, suma: sumaDe(key) }));
  const totalCarriles = carriles.reduce((x, c) => x + c.suma, 0);
  const pctCarril = (key: string) => pct(carriles.find((c) => c.key === key)?.suma ?? 0, totalCarriles);
  const masCargado = totalCarriles ? carriles.reduce((a, b) => (b.suma > a.suma ? b : a)) : null;
  const nombreCarril = (key: string) => (key === "izquierda" ? "la banda izquierda" : key === "derecha" ? "la banda derecha" : "el centro");
  const reparto = masCargado
    ? `Su ataque pasa más por ${nombreCarril(masCargado.key)}: ${pctCarril(masCargado.key)} % (izquierda ${pctCarril("izquierda")} · centro ${pctCarril("centro")} · derecha ${pctCarril("derecha")}, con las acciones progresivas).`
    : "";
  const porFuera =
    izq + der > 0
      ? dominante
        ? ` Sólo por fuera (centros, regates y pases al área), carga la banda ${dominante}: ${dominante === "izquierda" ? parteIzq : 100 - parteIzq} %.`
        : ` Sólo por fuera (centros, regates y pases al área), reparte: ${parteIzq} % izquierda · ${100 - parteIzq} % derecha.`
      : "";

  /* Su vídeo en Scout individual, con el jugador ya elegido (16/11/2026, ronda 18, fútbol). */
  const botonVideo = (jugador: string, rotulo = "▶ Su vídeo") => (
    <Link
      key={jugador}
      href={`/scout-rival-individual?${new URLSearchParams({ equipo, jugador }).toString()}`}
      className="ml-1 inline-flex items-center rounded-full border border-sky-400/30 px-1.5 py-px align-middle text-[11px] font-semibold text-sky-300 hover:border-sky-300"
      title={`Los cortes de ${jugador} en Scout individual`}
    >
      {rotulo}
    </Link>
  );

  /* Con `conVideo` a false, sin el «▶ Su vídeo» (las columnas de carriles lo ponen una vez por jugador al pie). */
  const nombre = (jugador: string, posicion: string, clase: string, conVideo = true) => {
    const href = enlaces.mapa.get(jugador);
    /* Primero el de la plantilla; sin cruce, la sigla de Wyscout en castellano. */
    const puesto = enlaces.puestos.get(jugador) || puestoEnPalabras(posicion.split(",")[0]) || posicion.split(",")[0].trim();
    const texto = (
      <>
        {jugador}
        {/* En castellano (16/11/2026, jueces de fútbol): «lateral izquierdo», no «LB». */}
        {/* Con espacio de verdad (17/11/2026, ronda 20): con sólo margen se copiaba «Javi Moreno(extremo derecho)». */}
        {puesto && <>{" "}<span className="text-[12px] font-normal text-white/60">({puesto})</span></>}
      </>
    );

    return (
      <>
        {href ? (
          <Link href={href} className={`${clase} hover:text-sky-300 hover:underline`} title={`Abrir la ficha de ${jugador} en Plantillas rivales`}>
            {texto}
          </Link>
        ) : (
          <span className={clase}>{texto}</span>
        )}
        {conVideo && <>{" "}{botonVideo(jugador)}</>}
      </>
    );
  };

  if (compacto) {
    return (
      <section id="x-idea-2120920359637856312-1" aria-label="Por dónde ataca" className="mb-6 rounded-2xl border border-sky-400/25 bg-sky-400/[0.05] px-5 py-3">
        <p className="flex flex-wrap items-baseline gap-x-2 text-base font-bold text-sky-300">
          Por dónde ataca
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/60">dato · Wyscout, temporada</span>
        </p>
        <p className="mt-1 text-sm leading-6 text-white/85">
          {reparto}
          {porFuera}
          {carga && (
            <>
              {" "}
              El {carga.parte} % {carga.tipo.deQue} sale de {nombre(carga.lider!.jugador, carga.lider!.posicion, "font-semibold text-white")}.
            </>
          )}
        </p>
        <Link href={conRivalEnUrl("/scout-rival-area", { equipo, id: rivalId })} className="mt-1 inline-block text-sm font-semibold text-sky-300 hover:underline">
          Banda a banda y quién carga cada una, en Área del rival ›
        </Link>
      </section>
    );
  }

  return (
    <section aria-label="Por dónde ataca" className="portada-tarjeta portada-entra mb-6 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        Por dónde ataca · sus tres carriles
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">dato · Wyscout, temporada</span>
      </p>
      {carga && (
        <h3 className="fuente-club mt-1.5 text-[24px] font-bold uppercase leading-[1.05] text-white sm:text-[30px]">
          {dominante ? `Carga la banda ${dominante}` : `El ${carga.parte} % ${carga.tipo.deQue} es de ${carga.lider!.jugador}`}
        </h3>
      )}

      <p className="mt-1 text-sm leading-6 text-white/80">
        {reparto}
        {porFuera}
        {carga && (
          <>
            {" "}
            El {carga.parte} % {carga.tipo.deQue} sale de {nombre(carga.lider!.jugador, carga.lider!.posicion, "font-semibold text-white")}{" "}
            por la banda {carga.banda}.
          </>
        )}
      </p>

      <CampoCarriles
        partes={BANDAS.map(({ key, label }) => {
          const parte = datos.bandas.find((b) => b.banda === key);
          const suma = parte ? TIPOS_ACCION.reduce((x, t) => x + parte.acciones[t.key], 0) : 0;
          /* Quién más carga ese carril, sumando sus cuatro tipos de acción. */
          const lideres = new Map<string, { jugador: string; posicion: string; n: number }>();
          /*
          | 17/11/2026 (ronda 20, fútbol): «Centro: lo carga Alberto González
          | (central)» no se dice en el vestuario. En el centro, el que carga sale
          | de centros, regates y pases al área; las acciones progresivas (que
          | suman los centrales) sólo si no hay nada más.
          */
          const sinProgresivas = key === "centro" && parte && TIPOS_ACCION.some((t) => t.key !== "progresivas" && parte.lider[t.key]);
          if (parte)
            for (const t of TIPOS_ACCION) {
              if (sinProgresivas && t.key === "progresivas") continue;
              const l = parte.lider[t.key];
              if (!l) continue;
              const v = lideres.get(l.jugador) ?? { jugador: l.jugador, posicion: l.posicion, n: 0 };
              v.n += l.acciones;
              lideres.set(l.jugador, v);
            }
          const lider = [...lideres.values()].sort((a, b) => b.n - a.n)[0] ?? null;
          return { key, label, suma, lider };
        })}
        nombre={nombre}
      />

      <ul className="mt-3 grid gap-3 md:grid-cols-3">
        {BANDAS.map(({ key, label }) => {
          const parte = datos.bandas.find((b) => b.banda === key);

          if (!parte) return null;

          return (
            <li key={key} className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
              <p className="text-[12px] font-bold uppercase tracking-wide text-white/70">{label}</p>
              <ul className="mt-1.5 space-y-2">
                {TIPOS_ACCION.map((t) => (
                  <Fila key={t.key} etiqueta={t.label} parte={parte.acciones[t.key]} total={total[t.key]}>
                    {parte.lider[t.key] && total[t.key] > 0 && (
                      <>
                        {nombre(parte.lider[t.key]!.jugador, parte.lider[t.key]!.posicion, "font-semibold text-white/85", false)}
                        <span className="text-white/55"> · {pct(parte.lider[t.key]!.acciones, total[t.key])} % del equipo</span>
                      </>
                    )}
                  </Fila>
                ))}
              </ul>
              {(() => {
                const jugadores = [...new Set(TIPOS_ACCION.map((t) => (total[t.key] > 0 ? parte.lider[t.key]?.jugador : undefined)).filter((j): j is string => Boolean(j)))];

                return jugadores.length > 0 ? (
                  <p className="mt-2 flex flex-wrap gap-1.5 border-t border-white/[0.08] pt-2">
                    {jugadores.map((j) => botonVideo(j, `▶ ${j}`))}
                  </p>
                ) : null;
              })()}
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-xs leading-5 text-white/50">
        Sus {datos.contados} jugadores de campo con minutos esta temporada. El lado sale del puesto principal en Wyscout (laterales, carrileros y extremos a su banda; el resto, al centro); los centros, del lado desde el que se centra. El % es sobre el total del equipo. Pincha un nombre para abrir su ficha.
        {/* 20/11/2026 (jueces de fútbol, /rivals y Área): 207 aquí y 208 en las barras del equipo. Son dos descargas de Wyscout distintas. */}
        {total.centros > 0 &&
          ` Sus ${total.centros} centros son la suma jugador a jugador; se rehacen con el «por 90» de cada uno y sus minutos, y el redondeo puede separarlos en uno o dos de la cifra del equipo en Wyscout (la de las barras de centros).`}
      </p>
    </section>
  );
}

/*
| EL CAMPO CON SUS TRES CARRILES (16/11/2026, como el original de X «¿Por qué
| carril ataca cada equipo?»): medio campo vertical atacando hacia arriba, cada
| carril sombreado según su parte de las acciones de ataque del equipo, con el
| porcentaje grande dentro y, debajo, quién lo carga. Antes sólo había barras.
*/
function CampoCarriles({
  partes,
  nombre,
}: {
  partes: { key: string; label: string; suma: number; lider: { jugador: string; posicion: string; n: number } | null }[];
  nombre: (jugador: string, posicion: string, clase: string) => React.ReactNode;
}) {
  const total = partes.reduce((x, p) => x + p.suma, 0);
  if (!total) return null;
  const max = Math.max(...partes.map((p) => p.suma));
  const ancho = 68 / 3;
  const carga = partes.reduce((a, b) => (b.suma > a.suma ? b : a));
  const linea = { stroke: "rgb(var(--rmcf-ink-rgb) / 0.35)", fill: "none", strokeWidth: 0.4 } as const;

  return (
    <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      {/* 20/11/2026 (jueces de Área): el campo era pequeño y «IZQ./CENTRO/DER.» salía a ~9 px; más ancho y rótulos a ≥11 px. */}
      <figure className="m-0 w-full max-w-[19rem] shrink-0">
        <svg viewBox="-2 -2 80 60" className="grafico-cabe-alto block w-full" role="img" aria-label={`Reparto de sus acciones de ataque por carril: ${partes.map((p) => `${p.label} ${Math.round((p.suma / total) * 100)} %`).join(", ")}`}>
          {partes.map((p, i) => {
            const k = p.suma / max;
            return (
              <g key={p.key}>
                <rect x={i * ancho} y={0} width={ancho} height={52.5} style={{ fill: `rgb(56 189 248 / ${(0.1 + 0.55 * k).toFixed(2)})` }} />
                <text x={i * ancho + ancho / 2} y={16} textAnchor="middle" style={{ fill: "rgb(var(--rmcf-ink-rgb) / 0.95)", fontSize: p === carga ? 9 : 7.2, fontWeight: 800 }}>
                  {Math.round((p.suma / total) * 100)}%
                </text>
                <text x={i * ancho + ancho / 2} y={24.5} textAnchor="middle" style={{ fill: "rgb(var(--rmcf-ink-rgb) / 0.7)", fontSize: 4.2, fontWeight: 700 }}>
                  {p.key === "izquierda" ? "IZQ." : p.key === "derecha" ? "DER." : "CENTRO"}
                </text>
              </g>
            );
          })}
          {/* Las líneas del medio campo (atacando hacia arriba): área, área chica, punto, medio círculo. */}
          <rect x={0} y={0} width={68} height={52.5} style={linea} />
          <rect x={13.84} y={0} width={40.32} height={16.5} style={linea} />
          <rect x={24.84} y={0} width={18.32} height={5.5} style={linea} />
          <path d="M26.69,16.5 A9.15,9.15 0 0 0 41.31,16.5" style={linea} />
          <path d="M24.85,52.5 A9.15,9.15 0 0 1 43.15,52.5" style={linea} />
          {[1, 2].map((i) => (
            <line key={i} x1={i * ancho} y1={0} x2={i * ancho} y2={52.5} style={{ ...linea, strokeDasharray: "1.2 1.2" }} />
          ))}
          <line x1={73} y1={50} x2={73} y2={8} style={{ stroke: "rgb(var(--rmcf-ink-rgb) / 0.45)", strokeWidth: 0.8 }} />
          <path d="M70.6,10 L73,5.5 L75.4,10 Z" style={{ fill: "rgb(var(--rmcf-ink-rgb) / 0.45)" }} />
        </svg>
        <figcaption className="mt-1 text-center text-[12px] text-white/60">Ataca hacia arriba · % de sus centros, regates, pases al área y acciones progresivas</figcaption>
      </figure>
      <ul className="min-w-0 flex-1 space-y-1.5 text-[13px]">
        {partes
          .filter((p) => p.lider)
          .map((p) => (
            <li key={p.key} className="min-w-0">
              <span className="font-semibold text-white/70">{p.label}:</span> lo carga {nombre(p.lider!.jugador, p.lider!.posicion, "font-semibold text-white")}
            </li>
          ))}
      </ul>
    </div>
  );
}

function Fila({
  etiqueta,
  parte,
  total,
  children,
}: {
  etiqueta: string;
  parte: number;
  total: number;
  children?: React.ReactNode;
}) {
  const p = pct(parte, total);

  return (
    <li className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="text-white/70">{etiqueta}</span>
        <span className="tabular-nums font-semibold text-white">
          {p} %<span className="ml-1 text-[11px] font-normal text-white/45">({parte})</span>
        </span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
        <div className="h-full rounded-full bg-sky-400/70" style={{ width: `${p}%` }} />
      </div>
      {children && <p className="mt-0.5 truncate text-[12px]">{children}</p>}
    </li>
  );
}

export default PorDondeAtaca;
