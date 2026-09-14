"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

import type { Alerta } from "@/lib/data-analisis/alertas";
import {
  alertasDeSeguimiento,
  type FilaSeguimiento,
  type JugadorPlantilla,
} from "@/lib/portada/alertas-otras";

/**
 * LO QUE HAY QUE MIRAR HOY, EN LA PORTADA.
 *
 * La plataforma tiene cuarenta pantallas y ninguna avisa: hay que acordarse de
 * entrar. Esta tira le da la vuelta —el dato sale a buscar a quien lo
 * necesita— y por eso va arriba del todo, debajo de la portada y antes que los
 * accesos: lo primero que se ve al abrir la aplicación es lo que se ha salido
 * de lo normal esta semana, para bien y para mal.
 *
 * **Las buenas cuentan tanto como las malas.** Un panel que sólo avisa de
 * problemas se lee como una bronca y en dos semanas nadie lo mira. Lo que el
 * equipo hace mejor que nadie es igual de accionable: se sostiene, se explota
 * y se enseña el lunes.
 *
 * Cada alerta lleva **su destino**: qué pantalla abre y qué mirar al llegar. Un
 * aviso sin destino es una preocupación, no una herramienta.
 *
 * De dónde salen: las de Data las calcula el servidor con el dataset que ya
 * tiene abierto (`/api/data-analisis?alertas=1`); las del seguimiento se
 * arman aquí con lo que la portada ya ha cargado para su tarjeta de cobertura.
 * Ninguna abre una hoja ni pide nada de más: esta pantalla es la que más se
 * abre de todas y no puede pagar por avisar.
 */

const VERDE = "#1B9E77";
const NARANJA = "#D95F02";

export function AlertasPortada({
  plantilla,
  seguimiento,
}: {
  plantilla: JugadorPlantilla[];
  seguimiento: FilaSeguimiento[];
}) {
  const [deData, setDeData] = useState<Alerta[] | null>(null);
  const [abierto, setAbierto] = useState(false);

  /* La hora a la que se abrió la pantalla: ver el efecto de abajo. */
  const [ahora, setAhora] = useState(0);

  useEffect(() => {
    const control = new AbortController();

    fetch("/api/data-analisis?alertas=1", { signal: control.signal })
      .then((r) => r.json())
      .then((r) => {
        if (control.signal.aborted) return;

        setDeData(Array.isArray(r?.alertas) ? (r.alertas as Alerta[]) : []);
      })
      .catch(() => {
        if (!control.signal.aborted) setDeData([]);
      });

    return () => control.abort();
  }, []);

  /*
  | El reloj, fuera del render y fuera del cuerpo del efecto.
  |
  | «Cuántos días lleva sin seguimiento» necesita saber qué día es hoy, y
  | mirarlo mientras se pinta es impuro: dos renders seguidos darían cosas
  | distintas. Se apunta la hora **una vez**, en un tiempo muerto —un
  | `setState` síncrono dentro del efecto encadena renders y lo para el
  | linter—, y a partir de ahí el cálculo vuelve a ser una función pura de
  | sus datos.
  */
  useEffect(() => {
    const id = setTimeout(() => setAhora(Date.now()), 0);

    return () => clearTimeout(id);
  }, []);

  const otras = useMemo(
    () => (ahora === 0 ? [] : alertasDeSeguimiento(plantilla, seguimiento, ahora)),
    [ahora, plantilla, seguimiento],
  );

  const alertas = useMemo(
    () => [...(deData ?? []), ...otras].sort((a, b) => b.fuerza - a.fuerza),
    [deData, otras],
  );

  const buenas = alertas.filter((a) => a.tono === "buena");
  const malas = alertas.filter((a) => a.tono === "mala");

  /* Mientras no haya llegado nada, la tira no ocupa sitio: la portada no se
     mueve al cargar, que es lo que hace que se sienta lenta. */
  if (deData === null || alertas.length === 0) return null;

  /* En la tira caben tres; el resto está a un clic. Y que se vea una de cada
     signo aunque las tres más fuertes sean del mismo. */
  const enLaTira = (() => {
    const fuertes = alertas.slice(0, 3);

    if (fuertes.some((a) => a.tono === "mala") || malas.length === 0) return fuertes;

    return [...fuertes.slice(0, 2), malas[0]];
  })();

  return (
    <>
      {/*
        Los tres tonos del degradado son los mismos que usan las tarjetas de la
        portada, y no es una casualidad estética: la tabla de equivalencias del
        modo día (`globals.css`) traduce **esos** y no otros. Con un azul
        inventado, la tira salía negra sobre fondo claro y el rótulo no se leía.
      */}
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#07121F] via-[#040B14] to-[#02060D] p-5 sm:p-6">
        {/* El halo: el mismo recurso de la portada, en verde o ámbar según
            de qué haya más. No decide nada, pero se ve desde lejos. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 12% 20%, ${
              malas.length > buenas.length ? "rgba(217,95,2,.16)" : "rgba(27,158,119,.16)"
            }, transparent 42%)`,
          }}
        />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#D8B45A]/25 bg-[#D8B45A]/[0.08]">
                <Bell className="h-4 w-4 text-[#D8B45A]" />
              </span>

              <div className="min-w-0">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.3em] text-white/85">
                  Alertas
                </h2>

                <p className="mt-1 text-[12px] text-white/45">
                  Lo que se ha salido de lo normal, con su sitio para mirarlo.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Cuenta color={VERDE} icono={TrendingUp} cuantas={buenas.length} rotulo="a favor" />

              <Cuenta color={NARANJA} icono={TrendingDown} cuantas={malas.length} rotulo="a vigilar" />

              <button
                type="button"
                onClick={() => setAbierto(true)}
                className="group inline-flex items-center gap-1.5 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3.5 py-2 text-[12px] font-medium text-[#C8A96B] transition hover:border-[#C8A96B]/70 hover:bg-[#C8A96B]/20"
              >
                Ver las {alertas.length}
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 lg:grid-cols-3">
            {enLaTira.map((alerta) => (
              <button
                key={alerta.clave}
                type="button"
                onClick={() => setAbierto(true)}
                className="group flex min-w-0 items-start gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <span
                  aria-hidden
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: alerta.tono === "buena" ? VERDE : NARANJA }}
                />

                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-white/85">
                    {alerta.titulo}
                  </span>

                  <span className="mt-0.5 block truncate text-[11px] tabular-nums text-white/40">
                    {alerta.cifra}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {abierto && (
        <Cajon alertas={alertas} alCerrar={() => setAbierto(false)} />
      )}
    </>
  );
}

/** Cuántas hay de cada signo, con su color y su icono: nunca sólo el color. */
function Cuenta({
  color,
  icono: Icono,
  cuantas,
  rotulo,
}: {
  color: string;
  icono: typeof TrendingUp;
  cuantas: number;
  rotulo: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium tabular-nums"
      style={{
        borderColor: `${color}55`,
        background: `${color}14`,
        color,
      }}
    >
      <Icono className="h-3.5 w-3.5" />
      {cuantas} {rotulo}
    </span>
  );
}

/**
 * El pop-up.
 *
 * Va en dos columnas —lo que va a favor y lo que hay que vigilar— porque son
 * dos conversaciones distintas: una se lleva a la charla del equipo y la otra
 * a la reunión del cuerpo técnico.
 */
function Cajon({ alertas, alCerrar }: { alertas: Alerta[]; alCerrar: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [alCerrar]);

  const buenas = alertas.filter((a) => a.tono === "buena");
  const malas = alertas.filter((a) => a.tono === "mala");

  return (
    <div
      /*
        El fondo del velo lo pone `.modal-veil` y **no** una clase de Tailwind.
        Con `bg-black/70` el modo día daba por hecho que dentro iba texto
        blanco —es lo que hacen los visores de foto— y pintaba en blanco todo
        lo de dentro: el panel salía en blanco sobre blanco y no se leía nada.
      */
      className="modal-veil fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-3 backdrop-blur-sm sm:p-6"
      data-export-hide
      role="dialog"
      aria-modal="true"
      aria-label="Alertas"
      onClick={alCerrar}
    >
      <div
        className="my-auto w-full max-w-5xl overflow-hidden rounded-[26px] border border-white/12 bg-[#11161D] shadow-[0_24px_80px_rgba(0,0,0,.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.32em] text-[#C8A96B]">
              Real Madrid Castilla
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              Lo que hay que mirar
            </h2>

            <p className="mt-1 text-[12px] leading-relaxed text-white/45">
              Sale de los informes de la categoría y de lo que el cuerpo técnico
              tiene registrado. Sólo aparece lo que se separa de lo normal: si un
              día no hay nada, es que no lo hay.
            </p>
          </div>

          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/60 transition hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid max-h-[70vh] gap-5 overflow-y-auto p-5 sm:p-6 lg:grid-cols-2">
          <Columna titulo="Lo que va a favor" color={VERDE} icono={TrendingUp} alertas={buenas} />

          <Columna titulo="Lo que hay que vigilar" color={NARANJA} icono={TrendingDown} alertas={malas} />
        </div>
      </div>
    </div>
  );
}

function Columna({
  titulo,
  color,
  icono: Icono,
  alertas,
}: {
  titulo: string;
  color: string;
  icono: typeof TrendingUp;
  alertas: Alerta[];
}) {
  return (
    <section className="min-w-0">
      <p
        className="mb-2.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]"
        style={{ color }}
      >
        <Icono className="h-3.5 w-3.5" />
        {titulo} · {alertas.length}
      </p>

      {alertas.length === 0 ? (
        <p className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-6 text-center text-[12px] text-white/35">
          Nada que destacar por aquí.
        </p>
      ) : (
        <div className="space-y-2.5">
          {alertas.map((alerta) => (
            <Link
              key={alerta.clave}
              href={alerta.enlace}
              className="group block rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
              style={{ borderLeft: `3px solid ${color}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-[13.5px] font-medium leading-snug text-white/90">
                  {alerta.titulo}
                </p>

                <ArrowUpRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:text-[#C8A96B]" />
              </div>

              <p className="mt-1.5 text-[12px] leading-relaxed text-white/50">
                {alerta.detalle}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                <span
                  className="rounded-lg px-2 py-1 font-medium tabular-nums"
                  style={{ background: `${color}14`, color }}
                >
                  {alerta.cifra}
                </span>

                <span className="text-white/30">{alerta.area}</span>
              </div>

              <p className="mt-2 text-[11px] text-white/35">
                <span className="text-white/50">Al abrir:</span> {alerta.mira}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
