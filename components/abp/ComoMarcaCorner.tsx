"use client";

/*
| CÓMO MARCA DE CÓRNER (23/11/2026, idea de X)
|
| En «¿Cuánto peligro tiene?» de /scout-rival-abp: los remates del rival que
| nacen de sus córners de liga, repartidos en primer contacto, segunda jugada
| y jugada en corto, con su conversión (goles por cada 10 córners) frente a la
| media de su grupo. Si pesa la segunda jugada, en ámbar quién remata el
| rechace y desde dónde (frontal o segundo palo), con los puntos en medio
| campo. Las cuentas, en lib/abp/corner-como-marca.ts.
|
| Datos: `opta:abp-eventos` (≈6,6 MB) y `opta:remates`; se piden cuando la
| tarjeta asoma (useAsoma), no al abrir la pantalla.
*/

import { useMemo } from "react";
import { Flag } from "lucide-react";

import { CampoOpta, SOBRE_CESPED } from "@/components/campo/CampoOpta";
import { Panel } from "@/components/abp/ui";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { useEnlaceClipOpta } from "@/hooks/useCortesOpta";
import { aObjetos, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { gruposDePartidos } from "@/lib/opta-abp";
import { nombreDeRival } from "@/lib/rivals/nombre-jugador";
import { casaEquipo, pistaDe, rematesDe, saquesDe } from "@/lib/opta-eventos";
import {
  GRUPOS_CORNER,
  comoMarca,
  pesaSegunda,
  rematadoresRechace,
  reparto,
  zonaRechace,
  type GrupoCorner,
} from "@/lib/abp/corner-como-marca";

export const ID_COMO_MARCA_CORNER = "x-idea-2124198517199749589-1";

const AMBAR_CESPED = "#F5B041";
const coma = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const pct = (v: number | null) => (v == null ? "" : `${Math.round(v * 100)} %`);
const fechaCorta = (f: string) => (f.length >= 10 ? `${f.slice(8, 10)}/${f.slice(5, 7)}` : "");

/** Con menos córners, la conversión es tendencia. */
const POCOS_CORNERS = 15;

/* `nombres`: los de su plantilla, para escribir a cada uno como en el resto del área («Sina», no el «Bema Sina» de Opta; 28/11/2026). */
export function ComoMarcaCorner({ equipo, nombres = [] }: { equipo: string; nombres?: string[] }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>();

  return (
    <div id={ID_COMO_MARCA_CORNER} ref={caja} className="scroll-mt-24">
      <Panel
        title="Cómo marca de córner"
        subtitle="Sus córners de liga (Opta): ¿gol al primer toque, en la segunda jugada o en corto?"
        icon={Flag}
      >
        {abierto ? <Cuerpo equipo={equipo} nombres={nombres} /> : <Esqueleto />}
      </Panel>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <p className="text-[13px] text-white/60">Leyendo cada córner de la liga…</p>
      <div className="h-40 animate-pulse rounded-2xl bg-white/[0.06]" />
    </div>
  );
}

function Cuerpo({ equipo, nombres }: { equipo: string; nombres: string[] }) {
  const { docs, cargando } = useDocsOpta<[TablaOpta, TablaOpta, TablaOpta, TablaOpta, TablaOpta]>(
    DOCS_OPTA.abpEventos,
    DOCS_OPTA.remates,
    DOCS_OPTA.jugadores,
    DOCS_OPTA.castilla,
    DOCS_OPTA.partidos,
  );
  const [abpT, rematesT, jugadoresT, castillaT, partidosT] = docs;
  const clip = useEnlaceClipOpta();

  const datos = useMemo(() => {
    const pista = pistaDe(aObjetos(jugadoresT), aObjetos(castillaT));
    const remates = rematesDe(rematesT, pista);
    const corners = saquesDe(abpT, remates, pista).filter((s) => s.abp === "corner");
    if (!corners.length) return null;
    const equipos = [...new Map(corners.map((s) => [s.teamId, { teamId: s.teamId, equipo: s.equipo }])).values()];
    const id = casaEquipo(equipo, equipos);
    if (!id) return { id: null } as const;
    const grupos = gruposDePartidos(partidosT);
    const suGrupo = grupos.get(id);
    const deLaLiga = suGrupo == null ? corners : corners.filter((s) => grupos.get(s.teamId) === suGrupo);
    const suyos = corners.filter((s) => s.teamId === id);
    const nEquipos = new Set(deLaLiga.map((s) => s.teamId)).size;
    const hasta = suyos.reduce((m, s) => (s.fecha > m ? s.fecha : m), "");
    return { id, eq: comoMarca(suyos), liga: comoMarca(deLaLiga), nEquipos, enGrupo: suGrupo != null, hasta } as const;
  }, [abpT, rematesT, jugadoresT, castillaT, partidosT, equipo]);

  if (cargando) return <Esqueleto />;
  if (!datos) return <p className="text-[13px] text-white/60">Aún no han llegado los córners de Opta.</p>;
  if (!datos.id) return <p className="text-[13px] text-white/60">No encuentro a {equipo} en Opta.</p>;

  const { eq, liga, nEquipos, enGrupo, hasta } = datos;
  if (!eq.corners) return <p className="text-[13px] text-white/60">Opta aún no tiene córners de {equipo} en liga.</p>;

  const rEq = reparto(eq);
  const rLiga = reparto(liga);
  const pesa = pesaSegunda(eq, liga);
  const totalRem = eq.grupos.primer.remates + eq.grupos.segunda.remates + eq.grupos.corto.remates;
  const mediaLiga = liga.conversion;
  const pocos = eq.corners < POCOS_CORNERS;
  const rechaces = eq.remates.filter((r) => r.grupo === "segunda");
  const quienes = rematadoresRechace(eq.remates).slice(0, 5);
  const zonas = { frontal: 0, "segundo palo": 0, "dentro del área": 0 };
  for (const r of rechaces) zonas[zonaRechace(r)] += 1;
  const nombreLiga = enGrupo ? `su grupo (${nEquipos} equipos)` : `la categoría (${nEquipos} equipos)`;

  const consigna =
    totalRem === 0
      ? "Sus córners casi no acaban en remate: el peligro no está aquí."
      : pesa
        ? "Pesa la segunda jugada: además de ganar el primer balón, hay que dejar gente en el rechace."
        : eq.grupos.primer.remates >= eq.grupos.corto.remates
          ? "Remata al primer toque: la clave es ganar el primer balón."
          : "Su peligro llega en corto: salir rápido a la jugada corta.";

  const colorGrupo = (g: GrupoCorner) => (g === "segunda" && pesa ? "var(--rmcf-rate-mid)" : "rgb(var(--rmcf-ink-rgb) / 0.55)");
  const colorPunto = (g: GrupoCorner) => (g === "segunda" ? (pesa ? AMBAR_CESPED : "rgba(255,255,255,0.85)") : g === "primer" ? SOBRE_CESPED.puerta : SOBRE_CESPED.tenue);

  return (
    <div className="min-w-0 space-y-4">
      <p className={`text-[13px] font-semibold ${pesa ? "text-amber-300" : "text-white/85"}`}>{consigna}</p>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {GRUPOS_CORNER.map(({ clave, rotulo, detalle }) => {
          const g = eq.grupos[clave];
          const parte = rEq[clave];
          const destaca = clave === "segunda" && pesa;
          return (
            <div
              key={clave}
              className={`min-w-0 rounded-xl border p-3 ${destaca ? "border-amber-400/50 bg-amber-400/[0.06]" : "border-white/10 bg-white/[0.02]"}`}
            >
              <p className={`text-[12px] font-semibold ${destaca ? "text-amber-300" : "text-white/80"}`}>{rotulo}</p>
              <p className="text-[11px] text-white/45">{detalle}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                {g.remates}
                <span className="ml-1 text-[12px] font-normal text-white/55">{g.remates === 1 ? "remate" : "remates"}</span>
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                <div className="h-full rounded-full" style={{ width: `${(parte ?? 0) * 100}%`, background: colorGrupo(clave) }} />
              </div>
              <p className="mt-1.5 text-[11px] tabular-nums text-white/60">
                {parte != null ? `${pct(parte)} de sus remates` : "sin remates"}
                {rLiga[clave] != null ? ` · liga ${pct(rLiga[clave])}` : ""}
              </p>
              <p className="text-[11px] tabular-nums text-white/60">
                {g.goles} {g.goles === 1 ? "gol" : "goles"} · xG {coma(g.xG, 2)}
              </p>
            </div>
          );
        })}

        <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-[12px] font-semibold text-white/80">Conversión</p>
          <p className="text-[11px] text-white/45">goles por cada 10 córners</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{eq.conversion != null ? coma(eq.conversion, 2) : ""}</p>
          <p className="mt-1.5 text-[11px] tabular-nums text-white/60">
            {eq.goles} {eq.goles === 1 ? "gol" : "goles"} en {eq.corners} córners · {eq.partidos} {eq.partidos === 1 ? "partido" : "partidos"}
          </p>
          {mediaLiga != null && (
            <p className="text-[11px] tabular-nums text-white/60">
              Media de {nombreLiga}: {coma(mediaLiga, 2)}
              {pocos ? " · pocos córners: tendencia" : ""}
            </p>
          )}
        </div>
      </div>

      {totalRem > 0 && (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <CampoOpta vertical mitad ariaLabel={`Remates de córner de ${equipo}`} maxAlto={380}>
              {(p) =>
                eq.remates.map((r, i) => {
                  const [cx, cy] = p(r.x, r.y);
                  const color = colorPunto(r.grupo);
                  return (
                    <a key={i} href={clip(r, "shots")} target="_blank" rel="noopener noreferrer" style={{ cursor: "pointer" }}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={7 + Math.sqrt(r.xG) * 20}
                        style={{ fill: color, fillOpacity: r.grupo === "segunda" && pesa ? 0.95 : 0.7, stroke: r.gol ? SOBRE_CESPED.gol : "rgba(0,0,0,0.45)", strokeWidth: r.gol ? 4 : 1.5 }}
                      >
                        <title>{`${fechaCorta(r.fecha)} ${r.minuto}′ · ${nombreDeRival(r.tirador, nombres)} · ${GRUPOS_CORNER.find((g) => g.clave === r.grupo)?.rotulo ?? ""} a los ${Math.round(r.tras)} s${r.grupo === "segunda" ? ` · ${zonaRechace(r)}` : ""} · xG ${coma(r.xG, 2)}${r.gol ? " · GOL" : ""}`}</title>
                      </circle>
                    </a>
                  );
                })
              }
            </CampoOpta>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/55">
              <Punto color={SOBRE_CESPED.puerta}>Primer contacto</Punto>
              <Punto color={pesa ? AMBAR_CESPED : "rgba(255,255,255,0.85)"}>Segunda jugada</Punto>
              <Punto color={SOBRE_CESPED.tenue}>En corto</Punto>
              <span>Aro dorado: gol · tamaño: xG</span>
            </p>
          </div>

          <div className="min-w-0 space-y-3">
            {rechaces.length > 0 && (
              <div className={`rounded-xl border p-3 ${pesa ? "border-amber-400/50 bg-amber-400/[0.06]" : "border-white/10"}`}>
                <p className={`text-[12px] font-semibold ${pesa ? "text-amber-300" : "text-white/80"}`}>Quién remata el rechace</p>
                <p className="mb-2 text-[11px] tabular-nums text-white/55">
                  Desde la frontal {zonas.frontal} · segundo palo {zonas["segundo palo"]} · dentro del área {zonas["dentro del área"]}
                </p>
                <ul className="space-y-1 text-[12px] tabular-nums">
                  {quienes.map((q) => {
                    const zona = (Object.entries(q.zonas) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
                    return (
                      <li key={q.tirador} className="flex min-w-0 items-baseline justify-between gap-2">
                        <span className={`truncate ${pesa ? "text-amber-300" : "text-white/85"}`}>{nombreDeRival(q.tirador, nombres)}</span>
                        <span className="shrink-0 text-white/60">
                          {q.remates} {q.remates === 1 ? "remate" : "remates"}
                          {q.goles ? ` · ${q.goles} ${q.goles === 1 ? "gol" : "goles"}` : ""} · sobre todo {zona[0]}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <p className="text-[11px] text-white/45">
              Visto desde quien saca: ataca hacia arriba. Frontal = a más de 12 m de la línea de fondo; segundo palo = más allá del poste lejano al saque.
              {eq.tardios ? ` ${eq.tardios} ${eq.tardios === 1 ? "remate llega" : "remates llegan"} pasados 10 s y no entran.` : ""} Pincha un punto para ver el vídeo.
            </p>
          </div>
        </div>
      )}

      <p className="text-[11px] text-white/45">
        Fuente: Opta, liga{hasta ? ` hasta el ${fechaCorta(hasta)}` : ""}. Remates del mismo equipo atados a su córner (misma jugada o rechace).
      </p>
    </div>
  );
}

function Punto({ color, children }: { color: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: "0 0 0 1px rgba(0,0,0,0.4)" }} />
      {children}
    </span>
  );
}
