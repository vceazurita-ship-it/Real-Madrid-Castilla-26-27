"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { traeJson } from "@/lib/hojaCsv";
import { asignaPerfiles } from "@/lib/rivals/perfil-wyscout";
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

export function PorDondeAtaca({ equipo, plantilla }: { equipo: string; plantilla: Ficha[] }) {
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

    if (!datos?.nombres?.length || !plantilla.length) return mapa;

    const asignados = asignaPerfiles(
      plantilla,
      datos.nombres.map((jugador) => ({ jugador })),
      (f) => playerKey(f),
    );

    for (const ficha of plantilla) {
      const casado = asignados.get(playerKey(ficha));

      if (casado) mapa.set(casado.jugador, fichaRivalPath(String(ficha.NOMBRE_EQUIPO ?? equipo), playerKey(ficha)));
    }

    return mapa;
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

  const nombre = (jugador: string, posicion: string, clase: string) => {
    const href = enlaces.get(jugador);
    const texto = (
      <>
        {jugador}
        {posicion && <span className="ml-1 text-[11px] font-normal text-white/50">{posicion}</span>}
      </>
    );

    return href ? (
      <Link href={href} className={`${clase} hover:text-sky-300 hover:underline`} title={`Abrir la ficha de ${jugador} en Plantillas rivales`}>
        {texto}
      </Link>
    ) : (
      <span className={clase}>{texto}</span>
    );
  };

  return (
    <section aria-label="Por dónde ataca" className="mb-6 rounded-2xl border border-sky-400/25 bg-sky-400/[0.05] px-5 py-4">
      <p className="flex flex-wrap items-baseline gap-x-2 text-base font-bold text-sky-300">
        Por dónde ataca
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/60">dato · Wyscout, temporada</span>
      </p>

      <p className="mt-1 text-sm leading-6 text-white/85">
        {dominante
          ? `Carga la banda ${dominante}: ${dominante === "izquierda" ? parteIzq : 100 - parteIzq} % de los centros, regates y pases al área que hace por fuera.`
          : izq + der > 0
            ? `Reparte por las dos bandas (${parteIzq} % izquierda · ${100 - parteIzq} % derecha en centros, regates y pases al área por fuera).`
            : null}
        {carga && (
          <>
            {" "}
            El {carga.parte} % {carga.tipo.deQue} sale de {nombre(carga.lider!.jugador, carga.lider!.posicion, "font-semibold text-white")}{" "}
            por la banda {carga.banda}.
          </>
        )}
      </p>

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
                        {nombre(parte.lider[t.key]!.jugador, parte.lider[t.key]!.posicion, "font-semibold text-white/85")}
                        <span className="text-white/55"> · {pct(parte.lider[t.key]!.acciones, total[t.key])} % del equipo</span>
                      </>
                    )}
                  </Fila>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-xs leading-5 text-white/50">
        Sus {datos.contados} jugadores de campo con minutos esta temporada. El lado sale del puesto principal en Wyscout (laterales, carrileros y extremos a su banda; el resto, al centro); los centros, del lado desde el que se centra. El % es sobre el total del equipo. Pincha un nombre para abrir su ficha.
      </p>
    </section>
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
