"use client";

/**
 * En obras · Apuestas del staff.
 *
 * Uno del cuerpo técnico tira una predicción, dice qué se juega y pone el día
 * en que se comprueba. Los demás se ponen a favor o en contra hasta ese día,
 * y llegado el día cualquiera que haya entrado dice si acertó o falló. El
 * marcador —aciertos y fallos de cada uno, lanzando y siguiendo— se cuenta
 * solo.
 *
 * Juegan las mismas personas que en la quiniela y con la misma cuenta: el
 * panel de acceso es el de allí (`components/quiniela/Acceso.tsx`). Las
 * reglas están en `lib/apuestas/modelo.ts` y las aplica el servidor en
 * `/api/apuestas/guardar`; aquí sólo se enseña y se pide.
 *
 * Si el staff pide otra cosa —puntos, apuestas con cuota, varias
 * comprobaciones— se cambia aquí sin tocar la quiniela.
 */

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Check,
  ChevronDown,
  Dices,
  ListOrdered,
  Megaphone,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AbpHeader, Button, Field, Panel, TextArea } from "@/components/abp/ui";
import { Acceso } from "@/components/quiniela/Acceso";
import { Avatar } from "@/components/quiniela/Avatar";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useApuestasDoc } from "@/hooks/useApuestasDoc";
import { useAhora, useQuinielaDoc } from "@/hooks/useQuinielaDoc";
import { useQuinielaSesion } from "@/hooks/useQuinielaSesion";
import {
  EN_JUEGO_MAXIMO,
  PREDICCION_MAXIMA,
  bandos,
  diasHasta,
  estadoDe,
  fechaLarga,
  hoyMadrid,
  marcador,
  ordenadas,
  puedePosicionarse,
  puedeResolverse,
  puedeRetirarse,
  sumaDias,
  type Apuesta,
  type EstadoApuesta,
  type Postura,
  type Veredicto,
} from "@/lib/apuestas/modelo";
import { JUEGAN_POR_DEFECTO, PERSONA_POR_SLUG, nombreCorto } from "@/lib/quiniela/staff";
import { JORNADAS, partidosDe } from "@/lib/quiniela/modelo";
import { confirmar } from "@/lib/avisos";
import { usePlayers } from "@/hooks/usePlayers";
import { urlGolesDelEquipo } from "@/lib/rivals/goles-en-video";
import type { Player } from "@/types/player";

type Guarda = ReturnType<typeof useApuestasDoc>["guarda"];

const nombreDe = (slug: string) => PERSONA_POR_SLUG.get(slug)?.nombre ?? slug;

const cortoDe = (slug: string) => {
  const persona = PERSONA_POR_SLUG.get(slug);

  return persona ? nombreCorto(persona) : slug;
};

/*
| 16/11/2026: los equipos de la liga que nombra una apuesta («El Alcorcón NO
| hace play off») llevan a su ficha de rival. Se buscan por la palabra que
| distingue al club en el calendario de la quiniela (Alcorcón, Jaén…), sin
| tildes ni mayúsculas.
*/
const sinTildes = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const GENERICAS = new Set(["club", "real", "deportivo", "union", "sociedad", "atletico", "athletic", "futbol", "balompie", "cultural"]);

const EQUIPOS_LIGA: { nombre: string; clave: string }[] = (() => {
  const nombres = [...new Set(JORNADAS.flatMap((j) => partidosDe(j).flatMap((p) => [p.local, p.visitante])))];

  return nombres.flatMap((nombre) => {
    const palabras = sinTildes(nombre)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !GENERICAS.has(w));
    const clave = palabras.sort((a, b) => b.length - a.length)[0];

    return clave ? [{ nombre, clave }] : [];
  });
})();

const equiposDe = (texto: string) => {
  const t = ` ${sinTildes(texto).replace(/[^a-z0-9\s]/g, " ")} `;

  return EQUIPOS_LIGA.filter((e) => t.includes(` ${e.clave} `));
};

/*
| 17/11/2026 (marketing): el jugador del Castilla que nombra la apuesta
| («Rachi marca gol al Teruel»), por su apodo o su nombre, para enlazar su
| ficha y su seguimiento. Palabras de 4 letras o más y enteras.
*/
const jugadoresDe = (texto: string, plantilla: Player[]) => {
  const t = ` ${sinTildes(texto).replace(/[^a-z0-9\s]/g, " ")} `;
  const vistos = new Set<string>();

  return plantilla.filter((j) => {
    if (!j.esCastilla || vistos.has(j.nombre)) return false;

    const claves = [j.apodo, j.nombre]
      .filter((x): x is string => Boolean(x))
      .map((x) => sinTildes(x).replace(/[^a-z0-9\s]/g, " ").trim())
      .filter((x) => x.length >= 4);
    const sale = claves.some((c) => t.includes(` ${c} `));

    if (sale) vistos.add(j.nombre);

    return sale;
  });
};

/* ?quien=slug (desde el ranking de la quiniela): las apuestas de esa persona. */
const suscribeUrl = (avisa: () => void) => {
  window.addEventListener("popstate", avisa);
  return () => window.removeEventListener("popstate", avisa);
};
const leeQuien = () => new URLSearchParams(window.location.search).get("quien") ?? "";

type Filtro = "todas" | "mias" | "sin-contrario";

const esMia = (a: Apuesta, yo: string | null) => Boolean(yo) && (a.autor === yo || Boolean(a.posturas[yo as string]));

const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** El grupo de una apuesta viva según cuándo se decide; la clave ordena. */
function grupoDe(a: Apuesta, hoy: string): { clave: string; titulo: string } {
  if (a.comprobar <= hoy) return { clave: "0", titulo: "Toca dar el veredicto" };
  if (diasHasta(a.comprobar, hoy) <= 30) return { clave: "1", titulo: "En los próximos 30 días" };

  const [anio, mes] = a.comprobar.split("-").map(Number);
  const nombre = MESES_LARGOS[(mes ?? 1) - 1] ?? "";
  const etiqueta = mes === 12 ? `Navidad · ${nombre} ${anio}` : mes === 5 || mes === 6 ? `Fin de liga · ${nombre} ${anio}` : `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;

  return { clave: `2-${a.comprobar.slice(0, 7)}`, titulo: etiqueta };
}

/*
| 17/11/2026 (marketing y guionista): un «qué se juega» de relleno no se
| enseña; es como si no hubiera nada escrito.
*/
const RELLENO_EN_JUEGO = /libreta del staff/i;

const enJuegoReal = (texto: string) => {
  const t = texto.trim();

  return t && !RELLENO_EN_JUEGO.test(t) ? t : "";
};

/** "2026-10-09T10:12:00.000Z" → "9 oct". */
function diaDe(iso: string) {
  const fecha = new Date(iso);

  if (Number.isNaN(fecha.getTime())) return "";

  return `${fecha.getDate()} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][fecha.getMonth()]}`;
}

export default function ApuestasPage() {
  const ahora = useAhora(60_000);

  const hoy = useMemo(() => hoyMadrid(ahora), [ahora]);

  const sesion = useQuinielaSesion();

  const yo = sesion.yo?.slug ?? null;

  const { doc, estado, guarda } = useApuestasDoc();

  const quien = useSyncExternalStore(suscribeUrl, leeQuien, () => "");
  const filtroQuien = quien && PERSONA_POR_SLUG.has(quien) ? quien : "";

  const { vivas, resueltas } = useMemo(() => {
    const todas = ordenadas(doc.apuestas, hoy);
    if (!filtroQuien) return todas;
    const suya = (a: Apuesta) => a.autor === filtroQuien || Boolean(a.posturas[filtroQuien]);
    return { vivas: todas.vivas.filter(suya), resueltas: todas.resueltas.filter(suya) };
  }, [doc, hoy, filtroQuien]);

  const tabla = useMemo(() => marcador(doc.apuestas), [doc]);

  const { players: plantilla } = usePlayers();

  /* 17/11/2026 (marketing y guionista): resumen, filtro y grupos por día de decisión. */
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const resumen = useMemo(() => {
    const esteMes = vivas.filter((a) => diasHasta(a.comprobar, hoy) <= 30).length;
    const sinContrario = vivas.filter((a) => bandos(a).contra.length === 0).length;
    /* 17/11/2026 (guionista): la de diferencia más corta entre los dos bandos y,
       a igualdad, la de más gente mojada; vivas ya va por fecha, así que a
       igualdad de todo gana la que se decide antes. */
    let disputada: { prediccion: string; favor: number; contra: number } | null = null;
    let mejor: [number, number] = [Infinity, 0];

    for (const a of vivas) {
      const { favor, contra } = bandos(a);
      const nFavor = favor.length + 1;

      if (contra.length === 0) continue;

      const diferencia = Math.abs(nFavor - contra.length);
      const gente = nFavor + contra.length;

      if (diferencia < mejor[0] || (diferencia === mejor[0] && gente > mejor[1])) {
        mejor = [diferencia, gente];
        disputada = { prediccion: a.prediccion, favor: nFavor, contra: contra.length };
      }
    }

    return { esteMes, sinContrario, disputada };
  }, [vivas, hoy]);

  const grupos = useMemo(() => {
    const filtradas = vivas.filter((a) =>
      filtro === "mias" ? esMia(a, yo) : filtro === "sin-contrario" ? bandos(a).contra.length === 0 : true,
    );
    const mapa = new Map<string, { clave: string; titulo: string; apuestas: Apuesta[] }>();

    for (const a of filtradas) {
      const g = grupoDe(a, hoy);
      const hay = mapa.get(g.clave);

      if (hay) hay.apuestas.push(a);
      else mapa.set(g.clave, { ...g, apuestas: [a] });
    }

    return [...mapa.values()].sort((a, b) => a.clave.localeCompare(b.clave));
  }, [vivas, filtro, yo, hoy]);

  /*
  | 30/10/2026: una sola base, la de la quiniela («11 jugando»): antes salía
  | «20 en el staff», que es la lista entera y no quien juega con cuenta.
  */
  const { doc: quiniela, estado: estadoQuiniela } = useQuinielaDoc();
  const juegan = quiniela.jugadores.length > 0 ? quiniela.jugadores.length : JUEGAN_POR_DEFECTO.length;

  /* Con sesión, el formulario va plegado tras «Lanzar apuesta» (30/10/2026). */
  const [lanzando, setLanzando] = useState(false);

  const sinApuestas = estado === "listo" && doc.apuestas.length === 0;

  /* El titular es el dato: cuántas hay abiertas y cuándo se comprueba la
     primera. Sin apuestas, la descripción de siempre. */
  /* 11/11/2026 (marketing): una sola línea con cifra y base; antes la cabecera,
     la línea de contexto y el panel decían tres veces «una apuesta abierta». */
  /* 11/11/2026 (marketing, 2.ª vuelta): la cifra de contexto sale UNA vez,
     aquí. La fecha y la cuenta atrás van en la tarjeta, que es donde se decide. */
  const titular =
    vivas.length > 1 && estadoQuiniela === "listo"
      ? `Pueden mojarse los ${juegan} de la quiniela; el día señalado se ve quién tenía razón.`
      : vivas.length > 0
      ? [
          vivas.length === 1 ? "1 apuesta abierta" : `${vivas.length} apuestas abiertas`,
          estadoQuiniela === "listo" ? `pueden mojarse los ${juegan} de la quiniela` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : "Uno tira una predicción y dice qué se juega. Los demás se ponen a favor o en contra, y el día señalado se comprueba quién tenía razón.";

  /* Lista de quienes pueden apostar: la de la quiniela o, si no ha llegado, la de siempre. */
  const quienesJuegan = quiniela.jugadores.length > 0 ? quiniela.jugadores : JUEGAN_POR_DEFECTO;

  /* Con apuestas abiertas, el acceso sólo dice el verbo: la cifra ya está en la cabecera. */
  const tituloAcceso =
    vivas.length > 0
      ? "Entra y ponte a favor o en contra"
      : estado === "listo" && doc.apuestas.length === 0
        ? "Aún no hay apuestas: entra y lanza la primera"
        : "Entra para apostar";

  const pasos = (
    <ol className="list-decimal space-y-1 pl-4">
      <li>Lanza tu predicción, di qué te juegas y pon el día de comprobación.</li>
      <li>Los demás se ponen a favor o en contra hasta el día antes.</li>
      <li>Ese día, cualquiera que haya entrado da el veredicto.</li>
    </ol>
  );

  const acceso = (
    <div id="acceso-apuestas" className="mt-5 scroll-mt-24">
      <Acceso
        yo={sesion.yo}
        cargando={sesion.cargando}
        manda={sesion.manda}
        titulo={tituloAcceso}
        subtitulo="Entra con tu cuenta de la quiniela"
        /* La franja de una línea: un solo botón de acceso y, con sesión, el nombre (30/10/2026). */
        compacto
        /* Sin apuestas, el formulario ya a la vista (07/11/2026, marketing): el primer paso es una acción. */
        abierto={sinApuestas}
        /* Un solo botón, «Entrar» (08/11/2026, marketing); el título ya dice qué viene después. */
        botonEntrar="Entrar"
        /* Lo que se ve sin entrar es lo de esta pantalla, no el ranking de la quiniela. */
        notaLectura={vivas.length > 0 ? "Para ver las apuestas abiertas no hace falta entrar." : ""}
      />
    </div>
  );

  const pide = async (cuerpo: Record<string, unknown>, exito: string) => {
    try {
      await guarda(cuerpo);

      toast.success(exito);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se ha podido");
    }
  };

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 pb-24 pt-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Laboratorio"
              title="Apuestas del staff"
              lead={titular}
            />

            {/* La cifra de contexto arriba, con los chips de la quiniela (30/10/2026). */}
            {estado === "listo" && vivas.length === 0 && doc.apuestas.length > 0 && (
              /* Una sola línea de contexto (07/11/2026, marketing): antes eran dos píldoras.
                 Con apuestas abiertas ya lo dice la cabecera (11/11/2026). */
              <p className="mt-4 text-[13px] tabular-nums text-white/70">
                <span className="font-semibold text-white/85">
                  {doc.apuestas.length === 1 ? "1 apuesta" : `${doc.apuestas.length} apuestas`}
                </span>
                {/* Qué significa la cifra (08/11/2026): quiénes pueden apostar. */}
                {estadoQuiniela === "listo" && ` · pueden apostar los ${juegan} con cuenta en la quiniela`}
              </p>
            )}

            {/* «Cómo funciona» baja al pie y en una línea (11/11/2026, marketing, 2.ª vuelta):
                arriba, aun plegado, dejaba la apuesta bajo el pliegue del móvil. */}

            {/* El acceso en la mitad de arriba, también sin apuestas: es la
                única acción; el ejemplo va plegado debajo (08/11/2026, marketing). */}
            {/* Un solo acceso, arriba (10/11/2026, marketing): las tarjetas ya no piden entrar cada una. */}
            {acceso}

            {filtroQuien && (
              <p className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/[0.07] px-3 py-2 text-sm text-white/85">
                <Avatar slug={filtroQuien} lado={24} />
                Las apuestas en las que está {nombreDe(filtroQuien)}
                <Link href="/laboratorio/apuestas" className="font-semibold text-[#C8A96B] hover:underline">
                  Ver todas
                </Link>
                <Link href="/quiniela" className="font-semibold text-[#C8A96B] hover:underline">
                  Su quiniela →
                </Link>
              </p>
            )}

            {/* ------------------------ LANZAR UNA --------------------- */}

            {yo && !lanzando && (
              <div className="mt-4">
                <Button tone="primary" icon={Megaphone} onClick={() => setLanzando(true)}>
                  {sinApuestas ? "Lanzar la primera apuesta" : "Lanzar apuesta"}
                </Button>
              </div>
            )}

            {yo && lanzando && (
              <div className="mt-5">
                <Lanzar guarda={guarda} hoy={hoy} ocupado={estado === "guardando"} onCierra={() => setLanzando(false)} />
              </div>
            )}

            {/* Sin ninguna apuesta publicada: el ejemplo, DEBAJO del acceso
                (30/10/2026, expertos), que es la llamada principal. Cuenta los
                tres pasos dentro del propio ejemplo: la lista aparte repetía lo
                mismo. */}
            {sinApuestas && (
              /* Mismo ancho que la tarjeta de entrada (07/11/2026): sin el margen del ⋮, que da la página. */
              /* Plegado (08/11/2026, marketing): el ejemplo competía con la acción real. */
              <details className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2">
                <summary className="flex min-h-11 cursor-pointer items-center text-[14px] font-semibold text-white/85">Ver cómo se verá</summary>
                {/* Ilustrativa y que se note (30/10/2026): borde discontinuo grueso,
                    sello dorado y «inventado» en el veredicto. */}
                <article aria-label="Ejemplo de apuesta, no es real" className="mb-2 mt-2 flex max-w-xl select-none flex-col gap-3 rounded-2xl border-2 border-dashed border-[#C8A96B]/50 bg-white/[0.02] p-4">
                  <span className="inline-flex w-fit items-center rounded-full bg-[#C8A96B] px-3 py-1 text-[12px] font-bold text-black">
                    Ejemplo · no es real
                  </span>
                  <p className="text-[15px] font-medium leading-snug text-white/90">
                    «El Castilla acaba la primera vuelta entre los cinco primeros»
                  </p>
                  <p className="text-[13px] text-white/65">
                    <span className="font-semibold text-white/70">Se juega:</span>{" "}
                    <span className="text-[#E4CE9B]">un desayuno para todo el staff</span>
                  </p>
                  <p className="text-[13px] leading-snug text-white/65">
                    Quien la lanza pone el día de comprobación: el último de la vuelta. Hasta el día antes, los demás se ponen a favor o en contra; ese día, cualquiera que haya entrado da el veredicto.
                  </p>
                  {/* Los dos botones de verdad, desactivados y sin cuentas inventadas
                      (07/11/2026, marketing): un «6 a favor» se leía como dato. */}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 text-[13px] font-medium text-emerald-300 disabled:cursor-not-allowed">
                      <ThumbsUp size={14} /> A favor
                    </button>
                    <button type="button" disabled className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 text-[13px] font-medium text-rose-300 disabled:cursor-not-allowed">
                      <ThumbsDown size={14} /> En contra
                    </button>
                  </div>
                  {/* El recuento tal cual saldrá, sin nombres inventados (08/11/2026). */}
                  <p className="text-[13px] tabular-nums text-white/75">
                    <span className="font-semibold text-emerald-300">0 a favor</span> ·{" "}
                    <span className="font-semibold text-rose-300">0 en contra</span>
                    <span className="block text-[12px] text-white/55">Debajo de cada lado saldrán los nombres de quienes se pongan.</span>
                  </p>
                  <p className="text-[13px] text-white/65">
                    Si se cumple, aciertan quien la lanzó y los que se pusieron a favor; si no, los que fueron en contra.
                  </p>
                </article>
              </details>
            )}



            {/* ------------------------ EN JUEGO ----------------------- */}

            {/* Sin apuestas en juego el panel no sale: la invitación a lanzar
                la primera ya la hace el panel de arriba. */}
            {(estado === "cargando" || estado === "error" || vivas.length > 0) && (
            <div className="mt-5">
              <Panel
                title="En juego"
                icon={Dices}
              >
                {/* El texto de apoyo a 12 px (10/11/2026): el subtítulo del panel se leía pequeño. */}
                {/* 17/11/2026 (marketing): con ~19 apuestas, un resumen con cifra y base,
                    filtros y la lista agrupada por cuándo se decide. */}
                {vivas.length > 1 && (
                  <div className="-mt-1 mb-4 space-y-3">
                    <ul className="grid grid-cols-3 gap-2">
                      {[
                        { cifra: vivas.length, rotulo: vivas.length === 1 ? "abierta" : "abiertas" },
                        { cifra: resumen.esteMes, rotulo: "se deciden en 30 días" },
                        { cifra: resumen.sinContrario, rotulo: "sin nadie en contra" },
                      ].map((d) => (
                        <li key={d.rotulo} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                          <span className="block text-[22px] font-bold leading-none tabular-nums text-white">{d.cifra}</span>
                          <span className="mt-1 block text-[12px] leading-tight text-white/65">{d.rotulo}</span>
                        </li>
                      ))}
                    </ul>

                    {resumen.disputada && (
                      <p className="text-[13px] leading-snug text-white/75">
                        <span className="font-semibold text-white">La más disputada</span>{" "}
                        <span className="text-white/55">(la de bandos más igualados y más gente mojada)</span>: «{resumen.disputada.prediccion}» ·{" "}
                        <span className="tabular-nums text-emerald-300">{resumen.disputada.favor} a favor</span>,{" "}
                        <span className="tabular-nums text-rose-300">{resumen.disputada.contra} en contra</span>
                      </p>
                    )}

                    {/* 17/11/2026 (marketing): un chip por bloque que salta a él. */}
                    {grupos.length > 1 && (
                      <nav aria-label="Ir a un bloque" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                        {grupos.map((g) => (
                          <a
                            key={g.clave}
                            href={`#bloque-${g.clave}`}
                            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#C8A96B]/40 px-3 text-[13px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/10"
                          >
                            {g.titulo}
                            <span className="tabular-nums text-white/60">{g.apuestas.length}</span>
                          </a>
                        ))}
                      </nav>
                    )}

                    <div role="group" aria-label="Filtrar apuestas" className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: "todas", texto: `Todas · ${vivas.length}` },
                          ...(yo ? [{ id: "mias", texto: `Las mías · ${vivas.filter((a) => esMia(a, yo)).length}` }] : []),
                          { id: "sin-contrario", texto: `Sin contrario · ${resumen.sinContrario}` },
                        ] as { id: Filtro; texto: string }[]
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          aria-pressed={filtro === f.id}
                          onClick={() => setFiltro(f.id)}
                          className={`min-h-9 rounded-full border px-3 text-[13px] font-semibold tabular-nums transition ${
                            filtro === f.id
                              ? "border-[#C8A96B] bg-[#C8A96B] text-black"
                              : "border-white/15 text-white/80 hover:border-[#C8A96B]/60"
                          }`}
                        >
                          {f.texto}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {estado === "cargando" && (
                  <p className="text-sm text-white/50">Leyendo las apuestas…</p>
                )}

                {estado === "error" && (
                  <p className="text-sm text-[#F6AFB6]">
                    No se han podido leer las apuestas. Recarga en un momento.
                  </p>
                )}

                {vivas.length > 0 && grupos.length === 0 && (
                  <p className="text-[13px] text-white/65">
                    Ninguna con este filtro.{" "}
                    <button type="button" onClick={() => setFiltro("todas")} className="font-semibold text-[#C8A96B] hover:underline">
                      Ver todas
                    </button>
                  </p>
                )}

                {/* Agrupadas por cuándo se deciden; dentro, la que antes se comprueba, primero. */}
                <div className="space-y-5">
                  {grupos.map((g) => (
                    <section key={g.clave} id={`bloque-${g.clave}`} aria-label={g.titulo} className="scroll-mt-24">
                      <h3 className="mb-2 flex items-baseline gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#C8A96B]">
                        {g.titulo}
                        <span className="text-[12px] font-medium normal-case tracking-normal text-white/60">
                          {g.apuestas.length === 1 ? "1 apuesta" : `${g.apuestas.length} apuestas`}
                        </span>
                      </h3>
                      {/* Dos columnas sólo con dos o más (10/11/2026): una sola apuesta dejaba media pantalla vacía. */}
                      {/* 17/11/2026 (marketing): las del mismo equipo, juntas en un bloque
                          plegable que dice cuántas son y cuáles. */}
                      {(() => {
                        const porEquipo = new Map<string, Apuesta[]>();

                        for (const a of g.apuestas) {
                          const e = equiposDe(a.prediccion)[0]?.nombre;

                          if (e) porEquipo.set(e, [...(porEquipo.get(e) ?? []), a]);
                        }

                        const juntas = [...porEquipo].filter(([, xs]) => xs.length >= 2);
                        const enJuntas = new Set(juntas.flatMap(([, xs]) => xs.map((x) => x.id)));
                        const sueltas = g.apuestas.filter((a) => !enJuntas.has(a.id));
                        const tarjeta = (apuesta: Apuesta) => (
                          <Tarjeta
                            key={apuesta.id}
                            apuesta={apuesta}
                            juegan={estadoQuiniela === "listo" ? quienesJuegan : []}
                            yo={yo}
                            hoy={hoy}
                            ocupado={estado === "guardando"}
                            pide={pide}
                            plantilla={plantilla}
                          />
                        );

                        return (
                          <div className="space-y-3">
                            {juntas.map(([equipo, xs]) => (
                              <details key={equipo} className="group rounded-2xl border border-white/10 bg-white/[0.02]">
                                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
                                  <span className="min-w-0">
                                    <span className="block text-[14px] font-semibold text-white">
                                      {equipo} · {xs.length} apuestas
                                    </span>
                                    <span className="mt-0.5 block text-[12px] leading-snug text-white/65">
                                      {xs
                                        .map((x) => {
                                          const b = bandos(x);

                                          return `«${x.prediccion}» ${b.favor.length + 1} a ${b.contra.length}`;
                                        })
                                        .join(" · ")}
                                    </span>
                                  </span>
                                  <ChevronDown size={16} aria-hidden className="mt-0.5 shrink-0 text-[#C8A96B] transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="grid gap-3 border-t border-white/10 p-3 lg:grid-cols-2">{xs.map(tarjeta)}</div>
                              </details>
                            ))}
                            {sueltas.length > 0 && (
                              <div className={`grid gap-3 ${sueltas.length > 1 ? "lg:grid-cols-2" : ""}`}>{sueltas.map(tarjeta)}</div>
                            )}
                          </div>
                        );
                      })()}
                    </section>
                  ))}
                </div>
              </Panel>
            </div>
            )}

            {/* ------------------------ RESUELTAS ---------------------- */}

            {resueltas.length > 0 && (
              <div className="mt-5">
                <Panel
                  title="Ya decididas"
                  subtitle="Las apuestas ya comprobadas, de la última a la primera"
                  action={
                    <Link href="/quiniela" className="text-[13px] font-semibold text-[#C8A96B] hover:underline">
                      Ranking de la quiniela →
                    </Link>
                  }
                  icon={CalendarCheck}
                >
                  <div className={`grid gap-3 ${resueltas.length > 1 ? "lg:grid-cols-2" : ""}`}>
                    {resueltas.map((apuesta) => (
                      <Tarjeta
                        key={apuesta.id}
                        apuesta={apuesta}
                        juegan={estadoQuiniela === "listo" ? quienesJuegan : []}
                        yo={yo}
                        hoy={hoy}
                        ocupado={estado === "guardando"}
                        pide={pide}
                        plantilla={plantilla}
                      />
                    ))}
                  </div>
                </Panel>
              </div>
            )}

            {/* ------------------------ MARCADOR ----------------------- */}

            {tabla.length > 0 && resueltas.length > 0 && (
            <div className="mt-5">
              <Panel
                title="Marcador"
                subtitle="Sólo cuentan las resueltas. Quien lanza acierta si se cumple; quien va a favor, con él; quien va en contra, si falla"
                icon={ListOrdered}
              >
                {(
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="text-left text-[12px] uppercase tracking-[0.16em] text-white/55">
                          <th className="pb-2 pr-3 font-semibold">#</th>
                          <th className="pb-2 pr-3 font-semibold">Quién</th>
                          <th className="pb-2 pr-3 text-right font-semibold">Lanzadas</th>
                          <th className="pb-2 pr-3 text-right font-semibold">Seguidas</th>
                          <th className="pb-2 pr-3 text-right font-semibold">Aciertos</th>
                          <th className="pb-2 pr-3 text-right font-semibold">Fallos</th>
                          <th className="pb-2 text-right font-semibold">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tabla.map((linea, indice) => (
                          <tr
                            key={linea.slug}
                            className={`border-t border-white/[0.06] ${linea.slug === yo ? "bg-[#C8A96B]/[0.06]" : ""}`}
                          >
                            <td className="py-2 pr-3 text-white/40">{indice + 1}</td>
                            <td className="py-2 pr-3">
                              <span className="inline-flex items-center gap-2">
                                <Avatar slug={linea.slug} lado={24} />
                                <span className="font-medium">{cortoDe(linea.slug)}</span>
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums text-white/70">{linea.lanzadas}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-white/70">{linea.seguidas}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-emerald-300">{linea.aciertos}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-rose-300">{linea.fallos}</td>
                            <td className="py-2 text-right font-semibold tabular-nums text-[#E4CE9B]">
                              {linea.balance > 0 ? `+${linea.balance}` : linea.balance}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>
            )}

            {/* ------------------------ CÓMO FUNCIONA ------------------ */}

            {estado === "listo" && doc.apuestas.length > 0 && (
              <details className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70">
                {/* 16/11/2026 (guionista): una sola frase, con el título delante y sin el punto suelto. */}
                <summary className="min-h-11 cursor-pointer py-2 text-[14px] leading-snug text-white/75">
                  <span className="font-semibold text-white/90">Cómo funciona:</span> uno lanza la apuesta, los demás se
                  mojan y el día señalado se da el veredicto.
                </summary>
                <div className="mb-2 mt-1">{pasos}</div>
              </details>
            )}

          </div>
        </section>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  LANZAR                                                            */
/* ------------------------------------------------------------------ */

function Lanzar({ guarda, hoy, ocupado, onCierra }: { guarda: Guarda; hoy: string; ocupado: boolean; onCierra?: () => void }) {
  const [prediccion, setPrediccion] = useState("");
  const [enJuego, setEnJuego] = useState("");
  const [comprobar, setComprobar] = useState("");
  const [enviando, setEnviando] = useState(false);

  const lista =
    prediccion.trim().length >= 8 && enJuego.trim().length > 0 && comprobar > hoy;

  /* Lo que falta, dicho: el botón apagado sin más no explicaba nada. */
  const falta =
    prediccion.trim().length < 8
      ? "Escribe la predicción (al menos 8 letras)"
      : !enJuego.trim()
        ? "Di qué te juegas"
        : !comprobar
          ? "Pon el día en que se comprueba"
          : comprobar <= hoy
            ? "El día tiene que ser mañana como pronto"
            : "";

  const lanza = async () => {
    setEnviando(true);

    try {
      await guarda({
        accion: "nueva",
        prediccion: prediccion.trim(),
        enJuego: enJuego.trim(),
        comprobar,
      });

      setPrediccion("");
      setEnJuego("");
      setComprobar("");

      toast.success("Apuesta lanzada. A ver quién se moja");
      onCierra?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se ha podido");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Panel
      title="Lanzar una apuesta"
      subtitle="Qué va a pasar, qué te juegas y el día en que se mira"
      icon={Megaphone}
      action={
        <div className="flex flex-wrap gap-2">
          {onCierra && <Button onClick={onCierra}>Cancelar</Button>}
          <Button
            tone="primary"
            icon={Megaphone}
            disabled={!lista || enviando || ocupado}
            title={falta || undefined}
            onClick={() => void lanza()}
          >
            {enviando ? "Lanzando…" : "Lanzarla"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr]">
        <TextArea
          label={`La predicción · ${prediccion.length}/${PREDICCION_MAXIMA}`}
          value={prediccion}
          onChange={(valor) => setPrediccion(valor.slice(0, PREDICCION_MAXIMA))}
          placeholder="El Castilla acaba la primera vuelta entre los cinco primeros"
          rows={3}
        />

        <Field
          label="Qué te juegas"
          value={enJuego}
          onChange={(valor) => setEnJuego(valor.slice(0, EN_JUEGO_MAXIMO))}
          placeholder="Un desayuno para todo el staff"
        />

        <Field
          label="Cuándo se comprueba"
          type="date"
          value={comprobar}
          onChange={setComprobar}
          /* Mañana como pronto, también en el calendario: antes dejaba
             elegir hoy o un día pasado y sólo se avisaba debajo (19/10/2026). */
          min={sumaDias(hoy, 1)}
          hint={
            comprobar && comprobar < hoy
              ? "Ese día ya ha pasado"
              : comprobar && comprobar === hoy
                ? "Hoy no: nadie podría ponerse a favor o en contra. Mañana como pronto"
                : comprobar
                  ? `Se mira el ${fechaLarga(comprobar)}. Hasta el día antes se admiten posturas`
                  : "Mañana como pronto. Hasta el día antes se admiten posturas"
          }
        />
      </div>

      {falta && (prediccion || enJuego || comprobar) && (
        <p className="mt-3 text-[13px] text-white/55">Para lanzarla: {falta.charAt(0).toLowerCase() + falta.slice(1)}.</p>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  LA TARJETA                                                       */
/* ------------------------------------------------------------------ */

const CHIP: Record<EstadoApuesta, { texto: (a: Apuesta, hoy: string) => string; clase: string }> = {
  abierta: {
    /* Con la cuenta atrás (11/11/2026, marketing): la fecha sola no metía prisa. */
    texto: (a, hoy) => {
      const dias = diasHasta(a.comprobar, hoy);

      return dias === 1
        ? "Veredicto mañana"
        : `Veredicto el ${fechaLarga(a.comprobar)} · faltan ${dias} días`;
    },
    clase: "border-[#C8A96B]/30 bg-[#C8A96B]/10 text-[#C8A96B]",
  },
  "a-comprobar": {
    texto: () => "Toca comprobarla",
    clase: "border-sky-300/30 bg-sky-300/10 text-sky-200",
  },
  acertada: {
    texto: () => "Acertada",
    clase: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  },
  fallada: {
    texto: () => "Fallada",
    clase: "border-rose-300/30 bg-rose-300/10 text-rose-200",
  },
};

function Tarjeta({
  apuesta,
  juegan = [],
  yo,
  hoy,
  ocupado,
  pide,
  plantilla = [],
}: {
  apuesta: Apuesta;
  plantilla?: Player[];
  /** Quiénes pueden apostar (los de la quiniela): la base del «faltan 9 de 11». Vacío si no se sabe. */
  juegan?: string[];
  yo: string | null;
  hoy: string;
  ocupado: boolean;
  pide: (cuerpo: Record<string, unknown>, exito: string) => Promise<void>;
}) {
  const estado = estadoDe(apuesta, hoy);

  const chip = CHIP[estado];

  const { favor, contra } = bandos(apuesta);

  const miPostura: Postura | null = yo ? (apuesta.posturas[yo] ?? null) : null;

  const soyAutor = yo === apuesta.autor;

  const puedoPosicionarme = puedePosicionarse(apuesta, yo, hoy);

  const puedoResolver = puedeResolverse(apuesta, yo, hoy);

  const puedoRetirar = puedeRetirarse(apuesta, yo);

  /* Retirarla la borra para siempre y no tiene deshacer: se pregunta. */
  const retira = async () => {
    if (!(await confirmar("¿Retirar esta apuesta? Se borra y no se puede recuperar."))) return;

    void pide({ accion: "retirar", id: apuesta.id }, "Apuesta retirada");
  };

  const postura = (nueva: Postura) =>
    void pide(
      { accion: "postura", id: apuesta.id, postura: miPostura === nueva ? null : nueva },
      miPostura === nueva
        ? "Te has quitado"
        : nueva === "favor"
          ? "Vas a favor"
          : "Vas en contra",
    );

  const veredicto = (dado: Veredicto | null) =>
    void pide(
      { accion: "veredicto", id: apuesta.id, veredicto: dado },
      dado === null ? "Veredicto deshecho" : dado === "acertada" ? "Acertada" : "Fallada",
    );

  return (
    <article
      className={`flex flex-col gap-2.5 rounded-2xl border p-3.5 ${
        estado === "acertada"
          ? "border-emerald-300/20 bg-emerald-300/[0.04]"
          : estado === "fallada"
            ? "border-rose-300/20 bg-rose-300/[0.04]"
            : "border-white/10 bg-white/[0.03]"
      }`}
    >
      {/* 17/11/2026 (marketing): tarjeta compacta. Autor y predicción en la
          misma fila que la cuenta atrás; sin cajas anidadas. */}
      <header className="flex items-start gap-3">
        <Avatar slug={apuesta.autor} lado={32} />

        <div className="min-w-0 flex-1">
          <p className="text-[12px] leading-tight text-white/65">
            <span className="font-semibold text-white/90">{cortoDe(apuesta.autor)}</span>
            {soyAutor && <span className="ml-1 font-semibold uppercase tracking-[0.12em] text-[#C8A96B]">tú</span>}
            {" · "}lanzada el {diaDe(apuesta.creadaEn)}
          </p>
          {/* La predicción es el titular, lo primero que se lee (11/11/2026). */}
          <p className="fuente-club mt-1 text-[20px] font-bold leading-tight text-white sm:text-[22px]">
            «{apuesta.prediccion}»
          </p>
        </div>

        {estado === "abierta" ? (
          <span className="shrink-0 text-right leading-tight">
            <span className="block text-[16px] font-bold tabular-nums text-[#C8A96B]">
              {diasHasta(apuesta.comprobar, hoy) === 1 ? "Mañana" : `${diasHasta(apuesta.comprobar, hoy)} días`}
            </span>
            <span className="block text-[12px] text-white/60">{fechaLarga(apuesta.comprobar)}</span>
          </span>
        ) : (
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] tabular-nums ${chip.clase}`}
          >
            {chip.texto(apuesta, hoy)}
          </span>
        )}
      </header>

      {/* «Se juega» sólo si hay algo escrito (17/11/2026: el relleno no se enseña). */}
      {enJuegoReal(apuesta.enJuego) && (
        <p className="text-[13px] leading-snug text-white/75">
          <span className="font-semibold text-[#C8A96B]">Se juega:</span>{" "}
          <span className="text-[#E4CE9B]">{enJuegoReal(apuesta.enJuego)}</span>
        </p>
      )}

      {/* 16/11/2026: el equipo de la apuesta, a un toque de su ficha. */}
      {/* 17/11/2026 (marketing): también sus goles en vídeo y, si nombra a un
          jugador nuestro, su ficha y su seguimiento. */}
      {(equiposDe(apuesta.prediccion).length > 0 || jugadoresDe(apuesta.prediccion, plantilla).length > 0) && (
        <div className="flex flex-wrap gap-2">
          {jugadoresDe(apuesta.prediccion, plantilla).map((j) => (
            <span key={j.nombre} className="inline-flex items-center overflow-hidden rounded-full border border-[#C8A96B]/40 text-[12px] font-medium">
              <Link
                href={`/individual?nombre=${encodeURIComponent(j.nombre)}`}
                className="px-2.5 py-0.5 text-white/85 transition hover:bg-[#C8A96B]/10 hover:text-white"
              >
                Ficha de {j.apodo || j.nombre} →
              </Link>
              <Link
                href={`/individual?nombre=${encodeURIComponent(j.nombre)}&pestana=seguimiento`}
                className="border-l border-[#C8A96B]/30 px-2.5 py-0.5 text-white/70 transition hover:bg-[#C8A96B]/10 hover:text-white"
              >
                Seguimiento
              </Link>
            </span>
          ))}
          {equiposDe(apuesta.prediccion).map((e) => (
            <span key={e.nombre} className="inline-flex items-center overflow-hidden rounded-full border border-white/15 text-[12px] font-medium">
              <Link
                href={`/rivals?equipo=${encodeURIComponent(e.nombre)}`}
                className="px-2.5 py-0.5 text-white/85 transition hover:bg-white/[0.06] hover:text-white"
              >
                Ficha de {e.nombre} →
              </Link>
              <Link
                href={urlGolesDelEquipo(e.nombre)}
                className="border-l border-white/15 px-2.5 py-0.5 text-white/70 transition hover:bg-white/[0.06] hover:text-white"
              >
                Sus goles
              </Link>
            </span>
          ))}
        </div>
      )}

      {/* ---------------------- los bandos ---------------------- */}

      {/* Una sola fila con caras y nombres de cada lado. La barra, sólo con
          dos o más votos: con uno pintaba un 100 % que confundía (17/11/2026). */}
      {(() => {
        const ladoFavor = [apuesta.autor, ...favor];
        const total = ladoFavor.length + contra.length;

        return (
          <div aria-label={`${ladoFavor.length} a favor y ${contra.length} en contra`} className="space-y-1.5">
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <Lado gente={ladoFavor} tono="favor" yo={yo} />
              <Lado gente={contra} tono="contra" yo={yo} />
            </div>
            {total >= 2 && contra.length > 0 && (
              /* 17/11/2026 (marketing): la barra con su reparto escrito («2 a 1»). */
              <div className="flex items-center gap-2">
                <div className="flex h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
                  <span className="h-full bg-emerald-400" style={{ width: `${(ladoFavor.length / total) * 100}%` }} />
                  <span className="h-full bg-rose-400" style={{ width: `${(contra.length / total) * 100}%` }} />
                </div>
                <span className="shrink-0 whitespace-nowrap text-[12px] font-semibold tabular-nums text-white/80">
                  {ladoFavor.length} a {contra.length}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Los dos botones, a la vista (11/11/2026). Compactos desde el 17/11/2026. */}
      {puedoPosicionarme && (
        <div className="grid grid-cols-2 gap-2">
          {(["favor", "contra"] as const).map((lado) => {
            const activo = miPostura === lado;
            const Icono = lado === "favor" ? ThumbsUp : ThumbsDown;
            const tono =
              lado === "favor"
                ? activo
                  ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-300"
                  : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15"
                : activo
                  ? "border-rose-400/60 bg-rose-400/20 text-rose-300"
                  : "border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15";

            return (
              <button
                key={lado}
                type="button"
                disabled={ocupado}
                aria-pressed={activo}
                title={activo ? "Vas aquí: pulsa para quitarte" : undefined}
                onClick={() => postura(lado)}
                className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-[14px] font-semibold transition disabled:cursor-wait disabled:opacity-60 ${tono}`}
              >
                <Icono size={15} aria-hidden /> {lado === "favor" ? "A favor" : "En contra"}
                {activo && <Check size={14} aria-label="vas aquí" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Sin sesión, un solo «Mojarme» que lleva al acceso de arriba. */}
      {!yo && estado === "abierta" && (
        <a
          href="#acceso-apuestas"
          className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 text-[13px] font-semibold text-[#C8A96B] hover:bg-[#C8A96B]/15"
        >
          <ThumbsUp size={14} aria-hidden /> Mojarme
        </a>
      )}

      {/* Quién falta por mojarse: la base con su cifra y los nombres al pulsar. */}
      {juegan.length > 0 && (() => {
        const mojados = new Set([apuesta.autor, ...favor, ...contra]);
        const faltan = juegan.filter((slug) => !mojados.has(slug));
        const yoFalto = Boolean(yo) && faltan.includes(yo as string);
        const fueron = juegan.length - faltan.length;

        if (estado !== "abierta" || faltan.length === 0) {
          return (
            <p className="text-[12px] tabular-nums text-white/65">
              {faltan.length === 0 ? `Se han mojado los ${juegan.length}` : `${fueron} de ${juegan.length} se mojaron`}
            </p>
          );
        }

        return (
          <details className="group text-[12px]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 tabular-nums text-white/70 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="font-semibold text-white/90">
                  {fueron} de {juegan.length}
                </span>{" "}
                se han mojado{yoFalto ? " · faltas tú" : ""}
              </span>
              <span className="shrink-0 font-semibold text-[#C8A96B]">
                <span className="group-open:hidden">Ver quién falta ({faltan.length})</span>
                <span className="hidden group-open:inline">Ocultar</span>
              </span>
            </summary>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
              {faltan.map((slug) => (
                <li key={slug} className="inline-flex items-center gap-1.5 text-[13px] text-white/80">
                  <Avatar slug={slug} lado={20} />
                  {cortoDe(slug)}
                </li>
              ))}
            </ul>
          </details>
        );
      })()}

      {/* ---------------------- el veredicto -------------------- */}

      {apuesta.veredicto ? (
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[12px] text-white/45">
          <span>
            {apuesta.veredicto === "acertada" ? "Acertó" : "Falló"}
            {apuesta.resueltaPor ? ` · lo dio ${cortoDe(apuesta.resueltaPor)}` : ""}
            {apuesta.resueltaEn ? ` el ${diaDe(apuesta.resueltaEn)}` : ""}
          </span>

          {puedoResolver && (
            <Button icon={Undo2} disabled={ocupado} onClick={() => veredicto(null)}>
              Deshacer
            </Button>
          )}
        </footer>
      ) : estado === "a-comprobar" ? (
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
          <span className="text-[12px] text-white/45">
            {puedoResolver ? "¿Qué ha pasado?" : "Entra para dar el veredicto"}
          </span>

          {puedoResolver && (
            <div className="flex flex-wrap gap-2">
              <Button icon={Check} tone="primary" disabled={ocupado} onClick={() => veredicto("acertada")}>
                Acertó
              </Button>
              <Button icon={X} tone="danger" disabled={ocupado} onClick={() => veredicto("fallada")}>
                Falló
              </Button>
              {puedoRetirar && (
                <Button icon={Trash2} disabled={ocupado} onClick={retira}>
                  Retirarla
                </Button>
              )}
            </div>
          )}
        </footer>
      ) : puedoRetirar ? (
        <footer className="flex items-center justify-end border-t border-white/[0.06] pt-3">
          <Button icon={Trash2} disabled={ocupado} onClick={retira}>
            Retirarla
          </Button>
        </footer>
      ) : null}
    </article>
  );
}

/**
 * Un lado de la apuesta en una línea: icono y cifra, caras apiladas y los
 * nombres cortos. Sin nadie, sólo la cifra (17/11/2026: «Nadie en contra
 * todavía: ¿te mojas?» se repetía en casi todas las tarjetas).
 */
function Lado({ gente, tono, yo }: { gente: string[]; tono: "favor" | "contra"; yo: string | null }) {
  const Icono = tono === "favor" ? ThumbsUp : ThumbsDown;
  const color = tono === "favor" ? "text-emerald-300" : "text-rose-300";

  return (
    <div className={`min-w-0 ${tono === "contra" ? "text-right" : ""}`}>
      <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${color}`}>
        <Icono size={13} aria-hidden />
        {gente.length} {tono === "favor" ? "a favor" : "en contra"}
      </span>
      {gente.length > 0 && (
        <span className={`mt-1 flex items-center gap-1.5 ${tono === "contra" ? "justify-end" : ""}`}>
          <span className="flex shrink-0 -space-x-1">
            {gente.slice(0, 4).map((slug) => (
              <Avatar key={slug} slug={slug} lado={22} />
            ))}
          </span>
          <span className="min-w-0 text-[12px] leading-tight text-white/80">
            {gente.map((slug) => (slug === yo ? "tú" : cortoDe(slug))).join(", ")}
          </span>
        </span>
      )}
    </div>
  );
}
