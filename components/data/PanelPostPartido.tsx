"use client";

/**
 * POST DEL PARTIDO (10/11/2026): la puerta con la que se abre Data análisis.
 *
 * Contesta «¿qué pasó y por qué?» del último partido del Castilla —o del que
 * se elija— con UN SOLO selector que manda sobre todo lo de abajo:
 *
 *   1. El cara a cara de las cifras, el momentum por tramos y los remates de
 *      los dos (Opta: `CaraACara`, `Momentum`, `MapaRemates` del área Opta).
 *   2. «Partido en el campo» de Wyscout (`PanelCampograma`, con el partido
 *      fijado): cada momento sobre el campo y lo que solemos hacer.
 *   3. Las fases acción a acción de Opta (`Fases`, sólo ese partido).
 *   4. Los laboratorios de robos, pérdidas y faltas abiertos en ese partido,
 *      y al pie, el microciclo.
 *
 * Las piezas se importan, no se copian. El partido se ata entre las dos
 * fuentes en `lib/post-partido.ts` (rival + fecha más cercana, ≤ 4 días). Si
 * una fuente aún no lo tiene, su bloque no se pinta y arriba lo dice.
 *
 * Los documentos pesados de Opta (remates ≈ 3 MB, acciones del Castilla
 * ≈ 3 MB, momento ≈ 1 MB) se piden sólo al montar esta puerta y se
 * comparten entre las piezas (`hooks/useDocsOpta.ts`).
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Crosshair, Footprints, LayoutGrid, ShieldAlert, Swords, Timer } from "lucide-react";

import { CaraACara } from "@/app/opta/_piezas/FichaPartido";
import { Fases } from "@/app/opta/_piezas/Fases";
import { Momentum } from "@/app/opta/_piezas/Momentum";
import { MapaRemates } from "@/app/opta/_piezas/Remates";
import { Elegir } from "@/app/opta/_piezas/comun";
import { nombreDe, useAcciones, useRemates } from "@/app/opta/_piezas/eventos";
import { alturaAccion, esPerdida, esProgresivo, esRecuperacion } from "@/lib/opta-eventos";
import { useOpta, type DatosOpta } from "@/app/opta/_piezas/useOpta";
import { Notice } from "@/components/abp/ui";
import { PanelCampograma } from "@/components/data/PanelCampograma";
import { RelievePartido } from "@/components/data/RelievePartido";
import { useAdmin } from "@/hooks/useAdmin";
import { DOCS_OPTA, aObjetos, traeOpta, type TablaOpta } from "@/lib/opta";
import { useCalendarioCastilla } from "@/components/data/SelloJornada";
import { Hueso } from "@/components/ui/estados";
import { SelloFuente } from "@/components/ui/SelloFuente";
import { chipInk } from "@/lib/theme";
import { partidoDeFecha } from "@/lib/data-analisis/alcance";
import type { FilaPartido } from "@/lib/data-analisis/leer";
import { temporadaDe } from "@/lib/data-analisis/metricas";
import { CASTILLA_OPTA } from "@/lib/opta";
import { fechaCorta, NOMBRE_CASTILLA } from "@/lib/opta-analisis";
import { CASTILLA_WYSCOUT, castillaWyscout, emparejaPartidos, enlaceConPartido, temporadaVigente, type PartidoPost } from "@/lib/post-partido";

/**
 * Lo contado a mano no es de ningún proveedor: no lleva `SelloFuente` (sólo
 * Opta y Wyscout), sino esta chapa con su misma forma, para que se lea igual.
 */
function SelloPropio({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10.5px] font-medium leading-tight text-white/55">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: chipInk("#C8A96B") }} />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

/**
 * Un bloque de la puerta: `section > header h2`, que es lo que lee el índice
 * fijo de la pantalla (`IndiceBloques`) para ponerle su chip.
 */
function Bloque({ titulo, pregunta, sello, icono: Icono, children }: { titulo: string; pregunta: string; sello: ReactNode; icono: typeof Swords; children: ReactNode }) {
  return (
    <section className="mt-5 min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <Icono size={16} className="mt-0.5 shrink-0 text-[#C8A96B]" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">{titulo}</h2>
            <p className="mt-0.5 text-xs text-white/55">{pregunta}</p>
          </div>
        </div>
        {sello}
      </header>
      {children}
    </section>
  );
}

/**
 * `wyscoutCaido`: el informe de Wyscout no se ha podido leer. Entonces sólo se
 * quita lo de Wyscout, con un aviso corto, y lo de Opta sigue entero.
 */
export function PanelPostPartido({ wyscout, wyscoutCaido = false }: { wyscout: FilaPartido[]; wyscoutCaido?: boolean }) {
  const { datos, cargando } = useOpta();
  const calendario = useCalendarioCastilla();

  const optaPartidos = useMemo(() => datos?.partidos ?? [], [datos]);
  const optaEquipos = useMemo(() => datos?.equipos ?? [], [datos]);
  const temporada = useMemo(() => temporadaVigente(optaPartidos, wyscout), [optaPartidos, wyscout]);
  const lista = useMemo(() => emparejaPartidos(optaPartidos, optaEquipos, wyscout, temporada), [optaPartidos, optaEquipos, wyscout, temporada]);

  /* Por defecto, el último jugado; lo elegido se guarda por su clave. */
  const [elegido, setElegido] = useState("");
  const visto = lista.find((p) => p.clave === elegido) ?? lista[0] ?? null;

  /* Lo de Wyscout para el campograma: la temporada de liga y la de la categoría. */
  const nuestrosW = useMemo(() => castillaWyscout(wyscout, temporada), [wyscout, temporada]);
  const contrariosW = useMemo(() => {
    const claves = new Set(nuestrosW.map((p) => `${p.fecha}|${p.partido}`));
    return wyscout.filter((p) => p.rival === CASTILLA_WYSCOUT && claves.has(`${p.fecha}|${p.partido}`));
  }, [wyscout, nuestrosW]);
  const ligaW = useMemo(() => wyscout.filter((p) => temporadaDe(p.fecha) === temporada && /primera/i.test(p.competicion)), [wyscout, temporada]);
  const equiposW = useMemo(() => new Set(ligaW.map((p) => p.equipo)).size, [ligaW]);

  const jornadaDe = (p: PartidoPost) => (calendario ? (partidoDeFecha(calendario.partidos, p.fecha)?.jornada ?? null) : null);
  const etiqueta = (p: PartidoPost) => {
    const j = jornadaDe(p);
    const marcador = p.gf != null && p.gc != null ? ` ${p.gf}-${p.gc}` : "";
    return `${j ? `J${j} · ` : ""}${fechaCorta(p.fecha)} · ${p.rival}${marcador}`;
  };

  if (cargando) {
    return (
      <div className="mt-5 space-y-4" role="status" aria-label="Cargando el partido">
        <Hueso className="h-24" />
        <Hueso className="h-96" />
      </div>
    );
  }

  const avisoWyscout = wyscoutCaido && (
    <div className="mt-5">
      <Notice tone="warn" title="Wyscout no ha cargado">
        Falta «Partido en el campo»; lo de Opta sale abajo. Pulsa «Actualizar datos» para volver a intentarlo.
      </Notice>
    </div>
  );

  if (!visto) return avisoWyscout || null;

  const cal = calendario ? partidoDeFecha(calendario.partidos, visto.fecha) : null;
  const enCasa = cal ? /castilla|real madrid/i.test(cal.local) : visto.wyscout ? visto.wyscout.partido.startsWith(CASTILLA_WYSCOUT) : null;
  const jornada = jornadaDe(visto);
  /* La jornada sólo si es la de verdad (la del calendario de BeSoccer). */
  const hasta = jornada ? `J${jornada}` : undefined;

  return (
    <>
      {avisoWyscout}

      {/* EL PARTIDO: el único selector, y lo que manda sobre todo lo de abajo. */}
      <div className="mt-5 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            {[jornada ? `Jornada ${jornada}` : "", fechaCorta(visto.fecha), enCasa === null ? "" : enCasa ? "en casa" : "fuera"].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-0.5 break-words text-lg font-semibold text-white sm:text-xl">
            {NOMBRE_CASTILLA}{" "}
            {visto.gf != null && visto.gc != null && <span className="tabular-nums text-[#C8A96B]">{`${visto.gf}-${visto.gc}`} </span>}
            {visto.rival}
          </p>
        </div>
        {lista.length > 1 && (
          <Elegir
            etiqueta="Partido"
            valor={visto.clave}
            alCambiar={setElegido}
            className="max-sm:w-full"
            opciones={lista.map((p) => ({ clave: p.clave, nombre: etiqueta(p) }))}
          />
        )}
      </div>

      {(!visto.opta || (!visto.wyscout && !wyscoutCaido)) && (
        <div className="mt-3">
          <Notice tone="info" title={!visto.wyscout ? "Wyscout aún no tiene este partido" : "Opta aún no tiene este partido"}>
            {!visto.wyscout
              ? "Su informe suele llegar el martes; entonces sale aquí el partido en el campo."
              : "Su descarga se hace los lunes; entonces salen aquí el cara a cara, el momentum, los remates y las fases."}
          </Notice>
        </div>
      )}

      {/* 0 · EL PARTIDO EN RELIEVE (14/11/2026): del evento a evento del directo de ese partido. */}
      {visto.opta && <RelieveDelPartido partido={visto.clave} />}

      {/* 1 · OPTA: EL CARA A CARA, EL MOMENTUM Y LOS REMATES */}
      {visto.opta && datos && <BloqueOpta datos={datos} partido={visto} hasta={hasta} />}

      {/* 2 · WYSCOUT: EL PARTIDO EN EL CAMPO */}
      {visto.wyscout && (
        <Bloque
          titulo="Partido en el campo"
          pregunta="¿Qué pasó en cada momento, y es lo que solemos hacer?"
          icono={LayoutGrid}
          sello={<SelloFuente fuente="wyscout" poblacion={equiposW ? `liga (${equiposW} equipos)` : "informe del partido"} hasta={hasta} className="shrink-0" />}
        >
          {/* 10/11/2026: dos proveedores en la misma pantalla; sin esta línea,
              2,0 de xG aquí y 1,6 arriba parecían una contradicción. */}
          {visto.opta && (
            <p className="mb-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] leading-snug text-white/70">
              Cifras de Wyscout: cuenta distinto que Opta (el cara a cara de arriba), así que xG, posesión o pases no coinciden. Aquí se comparan sólo con nuestra media de Wyscout.
            </p>
          )}
          <PanelCampograma
            /* Con la clave del partido: cambiarlo arriba empieza el bloque de cero. */
            key={visto.clave}
            nuestros={nuestrosW}
            contrarios={contrariosW}
            liga={ligaW}
            equipos={equiposW}
            temporada={temporada}
            fijo={`${visto.wyscout.fecha}|${visto.wyscout.rival}`}
          />
        </Bloque>
      )}

      {/* 3 · OPTA: LAS FASES ACCIÓN A ACCIÓN */}
      {visto.opta && datos && <BloqueFases datos={datos} partido={visto.clave} hasta={hasta} />}

      {/* 4 · LO CONTADO A MANO, ABIERTO EN ESTE PARTIDO */}
      <Bloque
        titulo="Visto en el vídeo"
        pregunta="Robos, pérdidas y faltas de este partido, contados jugada a jugada."
        icono={Crosshair}
        sello={<SelloPropio>Registro propio · vídeo</SelloPropio>}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <Enlace href={enlaceConPartido("/laboratorio/transiciones", visto)} icono={Swords} titulo="Robos y transiciones" texto="Qué hicimos con cada balón robado." />
          <Enlace href={enlaceConPartido("/laboratorio/perdidas", visto)} icono={ShieldAlert} titulo="Pérdidas y transiciones defensivas" texto="Qué hizo el rival con cada balón perdido." />
          <Enlace href={enlaceConPartido("/laboratorio/faltas", visto)} icono={Timer} titulo="Faltas" texto="Dónde se pitaron y con cuánta gente detrás." />
        </div>
      </Bloque>

      {/* AL PIE: QUÉ SE LLEVA A LA SEMANA */}
      <div className="mt-5 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#C8A96B]/25 bg-[#C8A96B]/[0.06] px-4 py-3 sm:px-5">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
          <CalendarDays size={16} className="shrink-0 text-[#C8A96B]" />
          ¿Qué toca en el microciclo?
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/microcycles" className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/85 hover:border-[#C8A96B]/50">
            Microciclo <ArrowRight size={14} />
          </Link>
          <Link href="/abp-microciclo" className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/85 hover:border-[#C8A96B]/50">
            Microciclo de ABP <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </>
  );
}

function Enlace({ href, icono: Icono, titulo, texto }: { href: string; icono: typeof Swords; titulo: string; texto: string }) {
  return (
    <Link href={href} className="group flex min-w-0 items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 transition hover:border-[#C8A96B]/50">
      <Icono size={15} className="mt-0.5 shrink-0 text-[#C8A96B]" />
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-semibold text-white">
          {titulo} <ArrowRight size={13} className="shrink-0 opacity-60 transition group-hover:translate-x-0.5" />
        </span>
        <span className="mt-0.5 block text-xs text-white/55">{texto}</span>
      </span>
    </Link>
  );
}

/** Las fases de Opta del partido; si su documento aún no trae el partido, el bloque no sale. */
function BloqueFases({ datos, partido, hasta }: { datos: DatosOpta; partido: string; hasta?: string }) {
  const { acciones, cargando } = useAcciones(datos);
  const delPartido = useMemo(() => acciones.filter((a) => a.nuestra && a.partido === partido), [acciones, partido]);
  const hay = delPartido.length > 0;
  /* 10/11/2026: tres ideas a la vista y el detalle plegado; la pantalla era muy larga. */
  /*
  | 11/11/2026 (experto de fútbol): las recuperaciones y las pérdidas, con los
  | MISMOS totales agregados de Opta que el cara a cara y los laboratorios de
  | robos y pérdidas (Recovery / PosWonA3rd, PossLost / PsLostD3). La cuenta
  | evento a evento daba 60 y 89 en el partido en que el resto de la app decía
  | 43 y 108. Sólo si la fila agregada falta se cae a los eventos, diciendo qué
  | cuentan.
  */
  const fila = useMemo(
    () => datos.partidos.find((f) => String(f.partido ?? "") === partido && f.teamId === CASTILLA_OPTA),
    [datos.partidos, partido],
  );
  const ideas = useMemo(() => {
    const num = (k: string) => {
      const v = fila?.[k];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    };
    const pases = delPartido.filter((a) => a.tipo === "Pass").length;
    const prog = delPartido.filter(esProgresivo).length;
    const pc = (n: number, de: number) => (de ? `${Math.round((n / de) * 100)} %` : "");
    const recT = num("Recovery");
    const recA = num("PosWonA3rd");
    const perT = num("PossLost");
    const perD = num("PsLostD3");
    const rec = delPartido.filter(esRecuperacion);
    const per = delPartido.filter(esPerdida);
    const recuperaciones =
      recT !== null && recA !== null
        ? `${recA} de ${recT} recuperaciones en el último tercio (${pc(recA, recT)})`
        : rec.length
          ? `${rec.filter((a) => alturaAccion(a.x) === "alta").length} de ${rec.length} recuperaciones en el último tercio (recuperaciones + intercepciones + entradas ganadas)`
          : "";
    const perdidas =
      perT !== null && perD !== null
        ? `${perD} de ${perT} pérdidas en nuestro primer tercio (${pc(perD, perT)})`
        : per.length
          ? `${per.filter((a) => alturaAccion(a.x) === "baja").length} de ${per.length} pérdidas en nuestro primer tercio (pases fallados + regates perdidos + robos en conducción)`
          : "";
    return [pases ? `${prog} pases progresivos de ${pases} (${pc(prog, pases)})` : "", recuperaciones, perdidas].filter(Boolean);
  }, [delPartido, fila]);
  if (!cargando && !hay) return null;
  return (
    <Bloque
      titulo="Acción a acción"
      pregunta="¿Cómo nos asociamos, cuánto progresamos y dónde robamos y perdimos?"
      icono={Footprints}
      sello={<SelloFuente fuente="opta" poblacion="evento a evento" hasta={hasta} partidos={1} className="shrink-0" />}
    >
      {ideas.length > 0 && (
        <ul className="mb-3 grid gap-2 sm:grid-cols-3">
          {ideas.map((t) => (
            <li key={t} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] font-medium leading-snug text-white/85">
              {t}
            </li>
          ))}
        </ul>
      )}
      <details className="group">
        <summary className="inline-flex min-h-[40px] cursor-pointer list-none items-center gap-1.5 rounded-xl border border-white/10 px-3 text-[13px] font-medium text-[#C8A96B] hover:border-[#C8A96B]/50 [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Ver la red de pases, la progresión y dónde robamos y perdimos</span>
          <span className="hidden group-open:inline">Ocultar el detalle</span>
        </summary>
        <div className="mt-3">
          <Fases datos={datos} partidoFijo={partido} />
        </div>
      </details>
    </Bloque>
  );
}

/**
 * La lectura del cara a cara (10/11/2026): qué se creó, qué se marcó y qué
 * nos deja. Sale de las mismas filas de `opta:partidos`; si falta un dato,
 * no se escribe la frase.
 */
function LecturaCara({ datos, partido, rival }: { datos: DatosOpta; partido: string; rival: string }) {
  const filas = datos.partidos.filter((f) => String(f.partido ?? "") === partido);
  const nos = filas.find((f) => f.teamId === CASTILLA_OPTA);
  const ellos = filas.find((f) => f.teamId !== CASTILLA_OPTA);
  const num = (f: (typeof filas)[number] | undefined, k: string) => {
    const v = f?.[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const g1 = num(nos, "Goal");
  const x1 = num(nos, "ExpG");
  const r1 = num(nos, "ShtIncBl");
  const g2 = num(ellos, "Goal");
  const x2 = num(ellos, "ExpG");
  const r2 = num(ellos, "ShtIncBl");
  if (g1 == null || x1 == null || g2 == null || x2 == null) return null;

  const d1 = (v: number) => v.toFixed(1).replace(".", ",");
  const remates = (n: number | null) => (n == null ? "" : ` en ${n} ${n === 1 ? "remate" : "remates"}`);
  const goles = (n: number) => `${n} ${n === 1 ? "gol" : "goles"}`;
  const frase = `Creamos ${d1(x1)} de xG${remates(r1)} y marcamos ${goles(g1)}; ${rival}, ${d1(x2)}${remates(r2)}, y marcó ${goles(g2)}.`;

  /* Qué nos deja: sólo cuando la distancia entre lo creado y lo marcado es clara (≥ 0,8). */
  const nosFalta = x1 - g1 >= 0.8;
  const nosSobra = g1 - x1 >= 0.8;
  const aEllosSobra = g2 - x2 >= 0.8;
  const aEllosFalta = x2 - g2 >= 0.8;
  const deja = [
    nosFalta ? "Nos sobró ocasión y faltó gol: la tarea es la finalización, no generar más." : "",
    nosSobra ? "Marcamos por encima de lo que creamos: no contar con repetirlo sin más ocasiones." : "",
    aEllosSobra ? `${rival} marcó muy por encima de lo que generó: revisar en el vídeo cómo llegaron sus goles, más que su volumen.` : "",
    aEllosFalta ? `${rival} falló más de lo esperable: lo que concedimos pudo costar más.` : "",
  ].filter(Boolean);

  return (
    <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[13px] leading-snug text-white/80">
      <p className="font-semibold text-white">{frase}</p>
      {deja.length > 0 && <p className="mt-1 text-white/70">{deja.join(" ")}</p>}
    </div>
  );
}

/** El cara a cara, el momentum y los remates de los dos, del partido de Opta. */
function BloqueOpta({ datos, partido, hasta }: { datos: DatosOpta; partido: PartidoPost; hasta?: string }) {
  const p = partido.opta!;
  const id = partido.clave;
  const { remates, cargando } = useRemates(datos);
  const delPartido = useMemo(() => remates.filter((r) => r.partido === id), [remates, id]);
  const lados = [
    { id: CASTILLA_OPTA, n: NOMBRE_CASTILLA },
    { id: p.rivalId, n: nombreDe(p.rivalId, p.rival) },
  ];

  return (
    <Bloque
      titulo="El partido, cara a cara"
      pregunta="¿Quién hizo más, cuándo mandó cada uno y desde dónde se remató?"
      icono={Swords}
      sello={<SelloFuente fuente="opta" poblacion="cifras del partido" hasta={hasta} partidos={1} className="shrink-0" />}
    >
      <LecturaCara datos={datos} partido={id} rival={lados[1].n} />
      <CaraACara datos={datos} partido={id} teamId={CASTILLA_OPTA} />
      <Momentum datos={datos} partido={id} teamId={CASTILLA_OPTA} />

      {cargando ? (
        <div className="mt-5 h-64 animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label="Cargando los remates" />
      ) : (
        delPartido.length > 0 && (
          <div className="mt-5 grid gap-5 border-t border-white/10 pt-4 lg:grid-cols-2">
            {lados.map((lado) => {
              const rs = delPartido.filter((r) => r.teamId === lado.id);
              return (
                <div key={lado.id} className="min-w-0">
                  <h3 className="mb-2 text-sm font-semibold text-white">Remates de {lado.n}</h3>
                  {rs.length ? <MapaRemates remates={rs} ariaLabel={`Remates de ${lado.n} en el partido`} enContra={lado.id !== CASTILLA_OPTA} maxAlto={360} /> : <p className="text-sm text-white/55">No remató.</p>}
                </div>
              );
            })}
          </div>
        )
      )}
    </Bloque>
  );
}

/* El relieve del partido: lo deja scripts/opta-directo.mjs en opta:directo:<partido>. Si aún no está, el
   administrador lo pide (1-2 minutos, desde GitHub). */
function RelieveDelPartido({ partido }: { partido: string }) {
  const [doc, setDoc] = useState<{ eventos?: TablaOpta; equipos?: TablaOpta } | null | undefined>(undefined);
  const [vuelta, setVuelta] = useState(0);
  const [pedido, setPedido] = useState(false);
  const { admin } = useAdmin();
  useEffect(() => {
    let vivo = true;
    void traeOpta<{ eventos?: TablaOpta; equipos?: TablaOpta }>(DOCS_OPTA.directo(partido)).then((d) => {
      if (vivo) setDoc(d);
    });
    return () => {
      vivo = false;
    };
  }, [partido, vuelta]);
  useEffect(() => {
    if (!pedido || doc?.eventos?.filas?.length) return;
    const t = window.setInterval(() => setVuelta((n) => n + 1), 20_000);
    return () => window.clearInterval(t);
  }, [pedido, doc]);
  const filas = aObjetos(doc?.equipos ?? null).sort((x, y) => (x.teamId === CASTILLA_OPTA ? -1 : y.teamId === CASTILLA_OPTA ? 1 : 0));
  const [x, y] = [filas[0], filas[1]];
  const nom = (f: Record<string, unknown>) => (f.teamId === CASTILLA_OPTA ? "Real Madrid Castilla" : String(f.equipo ?? ""));
  if (doc === undefined) return null;
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">El partido en 3D</h3>
      <p className="mb-2 text-[11px] text-white/45">
        Minuto a minuto (a lo largo), carril del campo (al fondo) y presión de ataque (en altura): oro el Castilla, rojo el rival. Cada pico es un remate de verdad, más alto
        cuanto más xG; la bola blanca, el gol. Los mapas, la red de pases y cada jugador, en Análisis de datos → En directo.
      </p>
      {doc?.eventos?.filas?.length && x && y ? (
        <RelievePartido eventos={doc.eventos} a={{ teamId: String(x.teamId ?? ""), nombre: nom(x), color: String(x.color ?? ""), campo: String(x.campo ?? "") }} b={{ teamId: String(y.teamId ?? ""), nombre: nom(y), color: String(y.color ?? ""), campo: String(y.campo ?? "") }} partido={partido} />
      ) : admin ? (
        <button
          type="button"
          disabled={pedido}
          onClick={() => {
            setPedido(true);
            void fetch("/api/opta/directo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partido, duracion: 15 }) });
          }}
          className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {pedido ? "Pedido a Opta: sale aquí en 1-2 minutos…" : "Cargar el relieve y los mapas de este partido"}
        </button>
      ) : (
        <p className="text-xs text-white/50">Aún no está el evento a evento de este partido.</p>
      )}
    </section>
  );
}
