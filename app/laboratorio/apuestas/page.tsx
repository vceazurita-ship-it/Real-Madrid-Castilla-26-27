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

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  KeyRound,
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
import { BotonGolesEnVideo } from "@/components/rivals/BotonGolesEnVideo";
import { conRivalEnUrl } from "@/lib/rivals/rival-en-curso";
import { filaDelEquipo } from "@/components/rivals/AccesosDelRival";
import { aJornada, type FilaRival, type JornadaRival } from "@/lib/abp/jornada";
import { traeJson } from "@/lib/hojaCsv";
import { esDeSeguimiento } from "@/lib/seguimiento";
import type { Player } from "@/types/player";

type Guarda = ReturnType<typeof useApuestasDoc>["guarda"];

const nombreDe = (slug: string) => PERSONA_POR_SLUG.get(slug)?.nombre ?? slug;

/** «Ana, Luis y Marta». */
const enLista = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

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
|
| 17/11/2026 (ronda 21): también por el apellido suelto («Fortuny» es Pol
| Fortuny), por los apodos del vestuario que la hoja no escribe («Rachi» es
| Rachad) y sin mirar la licencia: Cherif es del Juvenil A y está en la
| plantilla. Se resuelve por nombre, nunca por el JUG-XX (los ID se mueven).
| El seguimiento, sólo para quien lo lleva (sin porteros ni otras licencias).
*/
const APODOS_DEL_VESTUARIO: Record<string, string> = {
  rachi: "Rachad",
};

/* Apellidos que no distinguen a nadie: se quedan fuera del cruce suelto. */
const APELLIDOS_COMUNES = new Set(["martinez", "gonzalez", "garcia", "lopez", "fernandez", "rodriguez", "sanchez", "perez", "gomez", "diaz", "angel", "beto"]);

const plano = (x: string) => sinTildes(x).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const jugadoresDe = (texto: string, plantilla: Player[]) => {
  const t = ` ${plano(texto)} `;
  const vistos = new Set<string>();
  const porApodoExtra = new Set(
    Object.entries(APODOS_DEL_VESTUARIO)
      .filter(([apodo]) => t.includes(` ${apodo} `))
      .map(([, nombre]) => plano(nombre)),
  );

  return plantilla.flatMap((j) => {
    if (vistos.has(j.nombre)) return [];

    const nombre = plano(j.nombre);
    const apodo = plano(j.apodo ?? "");
    const apellido = nombre.split(" ").length > 1 ? (nombre.split(" ").at(-1) ?? "") : "";
    const dice = (c: string) => c.length >= 4 && t.includes(` ${c} `);
    const porApodo = dice(apodo) || porApodoExtra.has(nombre);
    const porNombre = dice(nombre) || (apellido.length >= 5 && !APELLIDOS_COMUNES.has(apellido) && dice(apellido));

    if (!porApodo && !porNombre) return [];

    vistos.add(j.nombre);

    return [{ jugador: j, rotulo: porApodo ? j.apodo || j.nombre : j.nombre }];
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

type Grupo = {
  /** Ordena los bloques. */
  clave: string;
  /** El rótulo del bloque («Fin de liga · mayo 2027»). */
  titulo: string;
  /** La parada de la línea de tiempo («Mayo») y lo que lleva debajo («fin de liga»). */
  corto: string;
  pie: string;
  /** Para la frase del titular: «se deciden …». */
  frase: string;
};

const mayuscula = (t: string) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`;

/*
| 18/11/2026 (análisis, ronda 22): «lo vivo» son las que se deciden en los
| próximos 60 días (o ya esperan veredicto) y la más disputada; van en
| tarjeta abierta. El resto se pliega por fecha de cierre, una fila por apuesta.
| 18/11/2026 (ronda 23): el mismo corte en la línea de tiempo («60 días»).
*/
const VIVO_DIAS = 60;

/**
 * El grupo de una apuesta viva según cuándo se decide; la clave ordena.
 * 17/11/2026 (guionista, ronda 21): mayo es el fin de liga y junio, el final
 * de temporada (allí hay finales europeas y debuts, no liga).
 */
function grupoDe(a: Apuesta, hoy: string): Grupo {
  if (a.comprobar <= hoy) {
    return { clave: "0", titulo: "Toca dar el veredicto", corto: "Ya", pie: "veredicto", frase: "ya, toca dar el veredicto" };
  }
  if (diasHasta(a.comprobar, hoy) <= VIVO_DIAS) {
    return { clave: "1", titulo: `En los próximos ${VIVO_DIAS} días`, corto: `${VIVO_DIAS} días`, pie: "próximos", frase: `en los próximos ${VIVO_DIAS} días` };
  }

  const [anio, mes] = a.comprobar.split("-").map(Number);
  const nombre = MESES_LARGOS[(mes ?? 1) - 1] ?? "";
  const clave = `2-${a.comprobar.slice(0, 7)}`;

  if (mes === 12) return { clave, titulo: `Navidad · ${nombre} ${anio}`, corto: "Navidad", pie: String(anio), frase: "en Navidad" };
  if (mes === 5) return { clave, titulo: `Fin de liga · ${nombre} ${anio}`, corto: "Mayo", pie: "fin de liga", frase: `a fin de liga (mayo de ${anio})` };
  if (mes === 6) {
    return { clave, titulo: `Final de temporada · ${nombre} ${anio}`, corto: "Junio", pie: "fin de temporada", frase: `al final de temporada (junio de ${anio})` };
  }

  return { clave, titulo: `${mayuscula(nombre)} ${anio}`, corto: mayuscula(nombre), pie: String(anio), frase: `en ${nombre} de ${anio}` };
}

/** Las vivas agrupadas por cuándo se deciden, en orden. */
function agrupa(apuestas: Apuesta[], hoy: string) {
  const mapa = new Map<string, Grupo & { apuestas: Apuesta[] }>();

  for (const a of apuestas) {
    const g = grupoDe(a, hoy);
    const hay = mapa.get(g.clave);

    if (hay) hay.apuestas.push(a);
    else mapa.set(g.clave, { ...g, apuestas: [a] });
  }

  return [...mapa.values()].sort((a, b) => a.clave.localeCompare(b.clave));
}

/** «3 a 1»: el autor cuenta a favor. */
const reparto = (a: Apuesta) => {
  const b = bandos(a);

  return { favor: b.favor.length + 1, contra: b.contra.length };
};

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

/** La de bandos más igualados (el autor cuenta a favor); a igualdad, más gente y luego la que antes se decide. */
function masDisputada(vivas: Apuesta[]) {
  let disputada: Apuesta | null = null;
  let mejor: [number, number] = [Infinity, 0];

  for (const a of vivas) {
    const { favor, contra } = reparto(a);

    if (contra === 0) continue;

    const diferencia = Math.abs(favor - contra);
    const gente = favor + contra;

    if (diferencia < mejor[0] || (diferencia === mejor[0] && gente > mejor[1])) {
      mejor = [diferencia, gente];
      disputada = a;
    }
  }

  return disputada;
}

/** Las de un mismo equipo (dos o más), juntas; el resto, sueltas. Mantiene el orden por fecha. */
function porEquipo(apuestas: Apuesta[]) {
  const mapa = new Map<string, Apuesta[]>();

  for (const a of apuestas) {
    const e = equiposDe(a.prediccion)[0]?.nombre;

    if (e) mapa.set(e, [...(mapa.get(e) ?? []), a]);
  }

  const juntas = [...mapa].filter(([, xs]) => xs.length >= 2);
  const enJuntas = new Set(juntas.flatMap(([, xs]) => xs.map((x) => x.id)));

  return { juntas, sueltas: apuestas.filter((a) => !enJuntas.has(a.id)) };
}

export default function ApuestasPage() {
  const ahora = useAhora(60_000);

  const hoy = useMemo(() => hoyMadrid(ahora), [ahora]);

  const sesion = useQuinielaSesion();

  const yo = sesion.yo?.slug ?? null;

  const { doc, estado, guarda } = useApuestasDoc();

  const quien = useSyncExternalStore(suscribeUrl, leeQuien, () => "");
  /*
  | 20/11/2026: «Ver todas» era un Link a la misma pantalla; la navegación de
  | Next no lanza `popstate`, así que el filtro por persona se quedaba puesto.
  | Ahora se quita aquí y la dirección se limpia a mano.
  */
  const [sinQuien, setSinQuien] = useState(false);
  const filtroQuien = !sinQuien && quien && PERSONA_POR_SLUG.has(quien) ? quien : "";
  const quitaQuien = () => {
    setSinQuien(true);
    window.history.replaceState(window.history.state, "", "/laboratorio/apuestas");
  };

  const { vivas, resueltas } = useMemo(() => {
    const todas = ordenadas(doc.apuestas, hoy);
    if (!filtroQuien) return todas;
    const suya = (a: Apuesta) => a.autor === filtroQuien || Boolean(a.posturas[filtroQuien]);
    return { vivas: todas.vivas.filter(suya), resueltas: todas.resueltas.filter(suya) };
  }, [doc, hoy, filtroQuien]);

  const tabla = useMemo(() => marcador(doc.apuestas).filter((l) => l.aciertos + l.fallos > 0), [doc]);

  const { players: plantilla } = usePlayers();

  const [filtro, setFiltro] = useState<Filtro>("todas");

  /*
  | Los bloques plegados que están abiertos (por su clave). 20/11/2026 (ronda
  | 7, marketing): mientras nadie toque nada, el primero va abierto, con sus
  | apuestas a la vista (`null` = «el de por defecto»).
  */
  const [abiertosElegidos, setAbiertos] = useState<Set<string> | null>(null);

  /* La parada de la línea de tiempo que filtra las listas (20/11/2026, ronda 7). */
  const [parada, setParada] = useState<string | null>(null);

  const alterna = (clave: string) =>
    setAbiertos((antes) => {
      const nuevo = new Set(antes ?? abiertos);

      if (nuevo.has(clave)) nuevo.delete(clave);
      else nuevo.add(clave);

      return nuevo;
    });

  const disputada = useMemo(() => masDisputada(vivas), [vivas]);

  const esViva = (a: Apuesta) => diasHasta(a.comprobar, hoy) <= VIVO_DIAS || a.id === disputada?.id;

  const pasaFiltro = (a: Apuesta) =>
    filtro === "mias" ? esMia(a, yo) : filtro === "sin-contrario" ? bandos(a).contra.length === 0 : true;

  /* 18/11/2026 (ronda 23): el filtro va encima de «El resto» y sólo vale para él. */
  const enParada = (a: Apuesta) => !parada || grupoDe(a, hoy).clave === parada;
  const loVivoTodo = vivas.filter((a) => esViva(a));
  const loVivo = loVivoTodo.filter(enParada);
  const resto = vivas.filter((a) => !esViva(a));
  const grupos = agrupa(resto.filter(pasaFiltro).filter(enParada), hoy);
  const primerGrupo = agrupa(resto, hoy)[0]?.clave;
  const abiertos = abiertosElegidos ?? new Set(primerGrupo ? [primerGrupo] : []);

  /* La línea de tiempo va con TODAS las vivas, sin el filtro. */
  const sinContrario = resto.filter((a) => bandos(a).contra.length === 0).length;

  const paradas = useMemo(() => agrupa(vivas, hoy), [vivas, hoy]);

  /*
  | Saltar desde la línea de tiempo: abre el bloque plegado o baja a lo vivo.
  | 20/11/2026 (ronda 7, marketing): además filtra las listas de abajo a esa
  | parada; pulsarla otra vez quita el filtro.
  */
  const irABloque = (clave: string) => {
    if (parada === clave) {
      setParada(null);
      return;
    }

    setParada(clave);
    setFiltro("todas");
    setAbiertos((antes) => new Set(antes ?? abiertos).add(clave));
    window.setTimeout(() => {
      const destino = document.getElementById("filtro-parada") ?? document.getElementById(`bloque-${clave}`);

      destino?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  /*
  | 17/11/2026 (marketing, ronda 21): el ID de la fila RIVALES de cada equipo,
  | para que «Plan» abra el plan de ese partido (la pantalla del plan sólo
  | entiende `?rival=`). La misma lectura cacheada que la tira del rival.
  */
  const [rivales, setRivales] = useState<JornadaRival[]>([]);

  useEffect(() => {
    let vivo = true;

    traeJson<unknown>("/api/rivals?action=rivales")
      .then((data) => {
        if (vivo && Array.isArray(data)) setRivales((data as FilaRival[]).filter((f) => f && typeof f === "object").map(aJornada));
      })
      .catch(() => {
        /* Sin la hoja, «Plan» no sale; Ficha, Sus goles y ABP van por el nombre. */
      });

    return () => {
      vivo = false;
    };
  }, []);

  /* Una sola base, la de la quiniela («11 jugando»). */
  const { doc: quiniela, estado: estadoQuiniela } = useQuinielaDoc();
  const juegan = quiniela.jugadores.length > 0 ? quiniela.jugadores.length : JUEGAN_POR_DEFECTO.length;

  /* Con sesión, el formulario va plegado tras «Lanzar apuesta» (30/10/2026). */
  const [lanzando, setLanzando] = useState(false);

  /* 18/11/2026 (análisis, ronda 22): el acceso es un botón pequeño en la cabecera; el formulario sale al pulsarlo. */
  const [entrando, setEntrando] = useState(false);

  const sinApuestas = estado === "listo" && doc.apuestas.length === 0;

  const titular =
    vivas.length > 0 && estadoQuiniela === "listo"
      ? `Pueden apostar los ${juegan} de la quiniela; el día señalado se ve quién tenía razón.`
      : vivas.length > 0
        ? "El día señalado se ve quién tenía razón."
        : "Uno tira una predicción y dice qué se juega. Los demás se ponen a favor o en contra, y el día señalado se comprueba quién tenía razón.";

  /* Lista de quienes pueden apostar: la de la quiniela o, si no ha llegado, la de siempre. */
  const quienesJuegan = estadoQuiniela === "listo" ? (quiniela.jugadores.length > 0 ? quiniela.jugadores : JUEGAN_POR_DEFECTO) : [];

  const abreAcceso = () => {
    setEntrando(true);
    window.setTimeout(() => document.getElementById("acceso-apuestas")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const pasos = (
    <ol className="list-decimal space-y-1 pl-4">
      <li>Lanza tu predicción, di qué te juegas y pon el día de comprobación.</li>
      <li>Los demás apuestan a favor o en contra hasta el día antes.</li>
      <li>Ese día, cualquiera que haya entrado da el veredicto.</li>
    </ol>
  );

  const pide = async (cuerpo: Record<string, unknown>, exito: string) => {
    try {
      await guarda(cuerpo);

      toast.success(exito);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se ha podido");
    }
  };

  const fila = (apuesta: Apuesta, extra: { desplegada?: boolean; sello?: string; sinEquipo?: string } = {}) => (
    <Tarjeta
      key={apuesta.id}
      apuesta={apuesta}
      juegan={quienesJuegan}
      yo={yo}
      hoy={hoy}
      ocupado={estado === "guardando"}
      pide={pide}
      plantilla={plantilla}
      rivales={rivales}
      {...extra}
    />
  );

  /* Las de un mismo equipo, bajo su nombre y con sus enlaces una sola vez; cada apuesta, la misma fila. */
  const filasPorEquipo = (apuestas: Apuesta[], desplegada = false) => {
    const { juntas, sueltas } = porEquipo(apuestas);

    return (
      <div className="space-y-3">
        {juntas.map(([equipo, xs]) => (
          <section key={equipo} aria-label={equipo} className="rounded-2xl border border-white/10 bg-white/[0.02] p-2.5 sm:p-3">
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
              <h4 className="text-[14px] font-semibold text-white">
                {equipo} <span className="font-medium text-white/60">· {xs.length} apuestas</span>
              </h4>
              <EnlacesEquipo nombre={equipo} rivales={rivales} hoy={hoy} />
            </div>
            <div className="space-y-2">{xs.map((a) => fila(a, { desplegada, sinEquipo: equipo }))}</div>
          </section>
        ))}
        {sueltas.length > 0 && <div className="space-y-2">{sueltas.map((a) => fila(a, { desplegada }))}</div>}
      </div>
    );
  };

  const cargadas = estado !== "cargando" && estado !== "error";

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 pb-24 pt-6 sm:px-6 lg:px-10">
            {/* 18/11/2026 (guionista, ronda 22): el antetítulo dice «Operativa», como el menú. */}
            <AbpHeader
              area="RMCF Castilla · Operativa"
              title="Apuestas del staff"
              lead={titular}
              aside={
                <span className="flex flex-wrap items-center justify-end gap-2">
                  {/* 18/11/2026 (ronda 23): la quiniela, con la misma cuenta, a un toque. */}
                  <Link
                    href="/quiniela"
                    className="inline-flex min-h-9 items-center rounded-full border border-white/15 px-3 text-[13px] font-semibold text-white/80 transition hover:border-[#C8A96B]/60 hover:text-white"
                  >
                    Quiniela de la semana →
                  </Link>
                {sesion.cargando ? null : sesion.yo ? (
                  <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-[12px] text-white/75">
                    <Avatar slug={sesion.yo.slug} lado={20} /> {sesion.yo.nombre}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={abreAcceso}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#C8A96B]/50 px-3 text-[13px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/10"
                  >
                    <KeyRound size={14} aria-hidden /> Entrar para apostar
                  </button>
                )}
                </span>
              }
            />

            {/* Sin sesión, el formulario sólo cuando se pide (o si no hay ninguna apuesta, que entrar es lo primero). */}
            {!sesion.yo && (entrando || sinApuestas) && (
              <div id="acceso-apuestas" className="mt-5 scroll-mt-24">
                <Acceso
                  yo={sesion.yo}
                  cargando={sesion.cargando}
                  manda={sesion.manda}
                  titulo={sinApuestas ? "Aún no hay apuestas: entra y lanza la primera" : "Entra para apostar"}
                  subtitulo="Entra con tu cuenta de la quiniela"
                  compacto
                  abierto
                  botonEntrar="Entrar"
                  notaLectura=""
                />
              </div>
            )}

            {estado === "listo" && vivas.length > 0 && (
              <LineaDeTiempo paradas={paradas} total={vivas.length} onIr={irABloque} elegida={parada} />
            )}

            {estado === "listo" && parada && paradas.some((p) => p.clave === parada) && (
              <p id="filtro-parada" className="mt-3 flex scroll-mt-24 flex-wrap items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/[0.07] px-3 py-2 text-[13px] text-white/85">
                {(() => {
                  const p = paradas.find((x) => x.clave === parada);
                  const n = p?.apuestas.length ?? 0;

                  return (
                    <span>
                      Sólo las que se deciden <span className="font-semibold">{p?.frase}</span>: {n === 1 ? "1 apuesta" : `${n} apuestas`}
                    </span>
                  );
                })()}
                <button type="button" onClick={() => setParada(null)} className="min-h-8 font-semibold text-[#C8A96B] hover:underline">
                  Ver todas
                </button>
              </p>
            )}

            {estado === "listo" && vivas.length === 0 && doc.apuestas.length > 0 && (
              <p className="mt-4 text-[13px] tabular-nums text-white/70">
                <span className="font-semibold text-white/85">
                  {doc.apuestas.length === 1 ? "1 apuesta, ya decidida" : `${doc.apuestas.length} apuestas, todas decididas`}
                </span>
                {estadoQuiniela === "listo" && ` · pueden apostar los ${juegan} con cuenta en la quiniela`}
              </p>
            )}

            {filtroQuien && (
              <p className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/[0.07] px-3 py-2 text-sm text-white/85">
                <Avatar slug={filtroQuien} lado={24} />
                Las apuestas en las que está {nombreDe(filtroQuien)}
                <button type="button" onClick={quitaQuien} className="min-h-8 font-semibold text-[#C8A96B] hover:underline">
                  Ver todas
                </button>
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

            {/* Sin ninguna apuesta publicada: el ejemplo, plegado y marcado como inventado. */}
            {sinApuestas && (
              <details className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2">
                <summary className="flex min-h-11 cursor-pointer items-center text-[14px] font-semibold text-white/85">Ver cómo se verá</summary>
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
                    Quien la lanza pone el día de comprobación: el último de la vuelta. Hasta el día antes, los demás apuestan a favor o en contra; ese día, cualquiera que haya entrado da el veredicto.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 text-[13px] font-medium text-emerald-300 disabled:cursor-not-allowed">
                      <ThumbsUp size={14} /> Apostar a favor
                    </button>
                    <button type="button" disabled className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 text-[13px] font-medium text-rose-300 disabled:cursor-not-allowed">
                      <ThumbsDown size={14} /> Apostar en contra
                    </button>
                  </div>
                  <p className="text-[13px] text-white/65">
                    Si se cumple, aciertan quien la lanzó y los que fueron a favor; si no, los que fueron en contra.
                  </p>
                </article>
              </details>
            )}

            {estado === "cargando" && <p className="mt-5 text-sm text-white/55">Leyendo las apuestas…</p>}

            {estado === "error" && (
              <p className="mt-5 text-sm text-[#F6AFB6]">No se han podido leer las apuestas. Recarga en un momento.</p>
            )}

            {/* ------------------------ LO VIVO ------------------------ */}

            {cargadas && vivas.length > 0 && !(parada && loVivo.length === 0) && (
              <section id="lo-vivo" aria-labelledby="lo-vivo-titulo" className="mt-6 scroll-mt-24">
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <h2 id="lo-vivo-titulo" className="fuente-club text-[20px] font-bold leading-tight text-white sm:text-[22px]">
                      Lo que se decide ya
                    </h2>
                    <p className="mt-0.5 text-[13px] text-white/65">
                      Las de los próximos {VIVO_DIAS} días y la más disputada
                    </p>
                  </div>

                </div>

                <Leyenda juegan={quienesJuegan.length} />

                {loVivo.length === 0 && !parada && (
                  <p className="mt-3 text-[13px] text-white/65">Ninguna se decide en los próximos {VIVO_DIAS} días.</p>
                )}

                {loVivo.length > 0 && (
                  /* 20/11/2026 (ronda 4, marketing): con un número impar, la última ocupa las dos columnas (dejaba un hueco a la derecha). */
                  <div className="mt-3 grid gap-3 lg:grid-cols-2 lg:[&>*:last-child:nth-child(odd)]:col-span-2">
                    {loVivo.map((a) =>
                      fila(a, {
                        desplegada: true,
                        sello:
                          a.id === disputada?.id
                            ? diasHasta(a.comprobar, hoy) <= VIVO_DIAS
                              ? "Se decide pronto · la más disputada"
                              : "La más disputada"
                            : a.comprobar <= hoy
                              ? "Toca dar el veredicto"
                              : "Se decide pronto",
                      }),
                    )}
                  </div>
                )}
                {disputada && loVivo.some((a) => a.id === disputada.id) && (
                  <p className="mt-2 text-[12px] text-white/55">
                    La más disputada es la de bandos más igualados (quien la lanza cuenta a favor); a igualdad, la de más gente y luego la que antes se decide.
                  </p>
                )}
              </section>
            )}

            {/* ------------------------ BALANCE ------------------------ */}

            {cargadas ? <BalancePorPersona apuestas={doc.apuestas} hoy={hoy} juegan={quienesJuegan} /> : null}

            {/* ------------------------ ACIERTOS ----------------------- */}

            {tabla.length > 0 && (
              <section aria-labelledby="aciertos-titulo" className="mt-6">
                <h2 id="aciertos-titulo" className="fuente-club text-[20px] font-bold leading-tight text-white">
                  Aciertos por persona
                </h2>
                <p className="mt-0.5 text-[13px] text-white/65">
                  Sólo las ya decididas. Quien lanza acierta si se cumple; quien va a favor, con él; quien va en contra, si falla
                </p>
                <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-[12px] uppercase tracking-[0.12em] text-white/60">
                        <th className="pb-2 pr-2 font-semibold">#</th>
                        <th className="pb-2 pr-2 font-semibold">Quién</th>
                        <th className="pb-2 pr-2 text-right font-semibold">Aciertos</th>
                        <th className="pb-2 pr-2 text-right font-semibold">Fallos</th>
                        <th className="pb-2 pr-2 text-right font-semibold">Acierto</th>
                        <th className="pb-2 text-right font-semibold">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabla.map((linea, indice) => (
                        <tr key={linea.slug} className={`border-t border-white/[0.06] ${linea.slug === yo ? "bg-[#C8A96B]/[0.06]" : ""}`}>
                          <td className="py-2 pr-2 text-white/55">{indice + 1}</td>
                          <td className="py-2 pr-2">
                            <span className="inline-flex items-center gap-2">
                              <Avatar slug={linea.slug} lado={22} />
                              <span className="font-medium">{cortoDe(linea.slug)}</span>
                            </span>
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums text-emerald-300">{linea.aciertos}</td>
                          <td className="py-2 pr-2 text-right tabular-nums text-rose-300">{linea.fallos}</td>
                          <td className="py-2 pr-2 text-right tabular-nums text-white/80">
                            {Math.round((linea.aciertos / (linea.aciertos + linea.fallos)) * 100)} %
                          </td>
                          <td className="py-2 text-right font-semibold tabular-nums text-[#E4CE9B]">
                            {linea.balance > 0 ? `+${linea.balance}` : linea.balance}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ------------------------ EL RESTO, PLEGADO -------------- */}

            {cargadas && resto.length > 0 && !(parada && grupos.length === 0) && (
              <section aria-labelledby="resto-titulo" className="mt-6">
                {resto.length > 1 && (
                  <div role="group" aria-label="Filtrar el resto de apuestas" className="mb-3 flex flex-wrap gap-2">
                    {(
                      [
                        /* «Las N que quedan» (18/11/2026, tres jueces): «Todas · 17» chocaba con «13 de las 19» del titular; las otras van arriba. */
                        { id: "todas", texto: `Las ${resto.length} que quedan` },
                        ...(yo ? [{ id: "mias", texto: `Las mías · ${resto.filter((a) => esMia(a, yo)).length}` }] : []),
                        { id: "sin-contrario", texto: `Nadie se ha opuesto · ${sinContrario}` },
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
                )}
                <h2 id="resto-titulo" className="fuente-club text-[20px] font-bold leading-tight text-white">
                  El resto, por fecha de cierre
                </h2>
                <p className="mt-0.5 text-[13px] text-white/65">Pulsa un bloque para ver sus apuestas; cada fila se abre para apostar</p>

                {grupos.length === 0 && (
                  <p className="mt-3 text-[13px] text-white/65">
                    Ninguna con este filtro.{" "}
                    <button type="button" onClick={() => setFiltro("todas")} className="font-semibold text-[#C8A96B] hover:underline">
                      Ver todas
                    </button>
                  </p>
                )}

                <div className="mt-3 space-y-2">
                  {grupos.map((g) => {
                    const abierto = abiertos.has(g.clave);
                    const primera = g.apuestas[0];
                    const dias = primera ? diasHasta(primera.comprobar, hoy) : 0;

                    return (
                      <section key={g.clave} id={`bloque-${g.clave}`} aria-label={g.titulo} className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03]">
                        <button
                          type="button"
                          aria-expanded={abierto}
                          onClick={() => alterna(g.clave)}
                          className="flex min-h-12 w-full items-center justify-between gap-3 py-2.5 pl-3.5 pr-10 text-left sm:pr-3.5"
                        >
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold uppercase tracking-[0.12em] text-[#C8A96B]">{g.titulo}</span>
                            <span className="block text-[12px] tabular-nums text-white/65">
                              {g.apuestas.length === 1 ? "1 apuesta" : `${g.apuestas.length} apuestas`}
                              {dias > 0 ? ` · la primera, en ${dias === 1 ? "1 día" : `${dias} días`}` : ""}
                            </span>
                            {/* 27/11/2026 (guionista): abierto, el título ya sale en su fila; el avance sólo con el bloque plegado. */}
                            {primera && !abierto && (
                              <span className="mt-1 line-clamp-2 block text-[13px] font-semibold leading-snug text-white/85">«{primera.prediccion}»</span>
                            )}
                          </span>
                          <ChevronDown size={18} aria-hidden className={`shrink-0 text-[#C8A96B] transition-transform ${abierto ? "rotate-180" : ""}`} />
                        </button>
                        {/* 20/11/2026 (ronda 5, marketing): la primera apuesta del bloque, con sus enlaces también plegado («Rachi» a su ficha, «el Alcorcón» a la suya). */}
                        {!abierto && primera ? (
                          <EnlacesDeLaApuesta texto={primera.prediccion} plantilla={plantilla} rivales={rivales} hoy={hoy} className="px-3.5 pb-3" />
                        ) : null}
                        {abierto && <div className="border-t border-white/10 p-2.5 sm:p-3">{filasPorEquipo(g.apuestas)}</div>}
                      </section>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ------------------------ RESUELTAS ---------------------- */}

            {resueltas.length > 0 && (
              <section aria-labelledby="decididas-titulo" className="mt-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="decididas-titulo" className="fuente-club text-[20px] font-bold leading-tight text-white">
                    Ya decididas
                  </h2>
                </div>
                <p className="mt-0.5 text-[13px] text-white/65">De la última a la primera</p>
                <div className="mt-3 space-y-2">{resueltas.map((a) => fila(a))}</div>
              </section>
            )}

            {/* ------------------------ CÓMO FUNCIONA ------------------ */}

            {estado === "listo" && doc.apuestas.length > 0 && (
              <details className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70">
                <summary className="min-h-11 cursor-pointer py-2 text-[14px] leading-snug text-white/75">
                  <span className="font-semibold text-white/90">Cómo funciona:</span> uno lanza la apuesta, los demás apuestan a favor o en contra y el día señalado se da el veredicto.
                </summary>
                <div className="mb-2 mt-1">{pasos}</div>
              </details>
            )}

            {/* Con sesión, la cuenta (cambiar contraseña, salir) al pie: arriba sólo va el nombre. */}
            {sesion.yo && (
              <div className="mt-5">
                <Acceso yo={sesion.yo} cargando={sesion.cargando} manda={sesion.manda} compacto />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

/** La leyenda de las barras, una vez para todas, con su base. */
function Leyenda({ juegan }: { juegan: number }) {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/70">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="h-3 w-5 rounded-sm bg-emerald-400" /> verde, a favor
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="h-3 w-5 rounded-sm bg-rose-400" /> rojo, en contra
      </span>
      <span>
        Quien la lanza cuenta a favor{juegan > 0 ? `; la base son los ${juegan} de la quiniela` : ""}
      </span>
    </p>
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
/*  LA FILA / TARJETA                                                 */
/* ------------------------------------------------------------------ */

const CHIP: Record<Exclude<EstadoApuesta, "abierta">, { texto: string; clase: string }> = {
  "a-comprobar": { texto: "Toca comprobarla", clase: "border-sky-300/30 bg-sky-300/10 text-sky-200" },
  acertada: { texto: "Acertada", clase: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" },
  fallada: { texto: "Fallada", clase: "border-rose-300/30 bg-rose-300/10 text-rose-200" },
};

const CHIP_ENLACE =
  "inline-flex min-h-8 items-center rounded-full border border-white/15 px-2.5 text-[12px] font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white";

/**
 * Los enlaces de lo que nombra una apuesta (20/11/2026, ronda 5): el jugador
 * nuestro, a su ficha y su seguimiento; el equipo de la liga, a su ficha,
 * goles, ABP y plan. Lo mismo que la tarjeta abierta, para el bloque plegado.
 */
function EnlacesDeLaApuesta({
  texto,
  plantilla,
  rivales,
  hoy,
  className = "",
}: {
  texto: string;
  plantilla: Player[];
  rivales: JornadaRival[];
  hoy: string;
  className?: string;
}) {
  const jugadores = jugadoresDe(texto, plantilla);
  const equipos = equiposDe(texto);

  if (!jugadores.length && !equipos.length) return null;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {jugadores.map(({ jugador, rotulo }) => (
        <div key={jugador.nombre} className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-semibold text-white/75">{rotulo}</span>
          <Link href={`/individual?nombre=${encodeURIComponent(jugador.nombre)}`} title={`La ficha de ${jugador.nombre} en Individual`} className={CHIP_ENLACE}>
            Ficha
          </Link>
          {esDeSeguimiento(jugador) && (
            <Link href={`/individual?nombre=${encodeURIComponent(jugador.nombre)}&pestana=seguimiento`} title={`El seguimiento de ${jugador.nombre}`} className={CHIP_ENLACE}>
              Su seguimiento
            </Link>
          )}
        </div>
      ))}
      {equipos.map((e) => (
        <div key={e.nombre} className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-semibold text-white/75">{e.nombre}</span>
          <EnlacesEquipo nombre={e.nombre} rivales={rivales} hoy={hoy} />
        </div>
      ))}
    </div>
  );
}

/**
 * EL BALANCE DEL GRUPO (20/11/2026, ronda 5, marketing): una barra por persona
 * con sus apuestas ganadas, perdidas y pendientes (en las que lanzó o se puso
 * a un lado), y una frase con lo que dice. Ganadas y perdidas, las del
 * marcador de abajo; pendientes, las que aún no tienen veredicto.
 */
function BalancePorPersona({ apuestas, hoy, juegan }: { apuestas: Apuesta[]; hoy: string; juegan: string[] }) {
  const lineas = marcador(apuestas);
  const { vivas } = ordenadas(apuestas, hoy);
  const quienes = [...new Set([...juegan, ...lineas.map((l) => l.slug)])];

  const filas = quienes
    .map((slug) => {
      const l = lineas.find((x) => x.slug === slug);
      const pendientes = vivas.filter((a) => a.autor === slug || Boolean(a.posturas[slug])).length;

      return { slug, ganadas: l?.aciertos ?? 0, perdidas: l?.fallos ?? 0, pendientes };
    })
    .filter((f) => f.ganadas + f.perdidas + f.pendientes > 0)
    .sort((a, b) => b.ganadas - b.perdidas - (a.ganadas - a.perdidas) || b.pendientes - a.pendientes);

  if (!filas.length) return null;

  const decididasAntes = filas.reduce((s, f) => s + f.ganadas + f.perdidas, 0);

  /*
  | 20/11/2026 (ronda 7, marketing): sin ningún veredicto, las barras eran
  | todas grises («0 · 0 · 19»). Hasta que haya uno, una línea.
  */
  /* 27/11/2026 (guionista): lo que no tiene dato no se nombra; el balance sale cuando haya una apuesta decidida. */
  if (decididasAntes === 0) return null;

  const tope = Math.max(...filas.map((f) => f.ganadas + f.perdidas + f.pendientes));
  const decididas = filas.reduce((s, f) => s + f.ganadas + f.perdidas, 0);
  const mejor = filas.find((f) => f.ganadas > 0);
  const conclusion =
    decididas === 0
      ? `Aún no se ha decidido ninguna: ${filas.length} ${filas.length === 1 ? "persona tiene" : "personas tienen"} apuestas en juego.`
      : mejor
        ? `Va por delante ${cortoDe(mejor.slug)}: ${mejor.ganadas} ${mejor.ganadas === 1 ? "ganada" : "ganadas"} y ${mejor.perdidas} ${mejor.perdidas === 1 ? "perdida" : "perdidas"}.`
        : "De las decididas, nadie ha ganado todavía.";

  return (
    <section aria-labelledby="balance-titulo" className="mt-6">
      <h2 id="balance-titulo" className="fuente-club text-[20px] font-bold leading-tight text-white">
        Balance por persona
      </h2>
      <p className="mt-0.5 text-[13px] font-semibold text-white/85">{conclusion}</p>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-white/65">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" aria-hidden />
          ganadas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-400" aria-hidden />
          perdidas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-white/40 bg-white/15" aria-hidden />
          pendientes
        </span>
      </p>
      <ul className="mt-3 space-y-1.5 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
        {filas.map((f) => {
          const ancho = (n: number) => `${(n / tope) * 100}%`;

          return (
            <li key={f.slug} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-2 text-[13px]">
              <span className="inline-flex min-w-0 items-center gap-2">
                <Avatar slug={f.slug} lado={20} />
                <span className="truncate font-medium text-white/85">{cortoDe(f.slug)}</span>
              </span>
              <span className="flex h-3 overflow-hidden rounded-full bg-white/[0.05]" aria-hidden>
                <span className="h-full bg-emerald-400" style={{ width: ancho(f.ganadas) }} />
                <span className="h-full bg-rose-400" style={{ width: ancho(f.perdidas) }} />
                <span className="h-full bg-white/20" style={{ width: ancho(f.pendientes) }} />
              </span>
              <span className="whitespace-nowrap text-right text-[12px] tabular-nums text-white/70">
                <span className="text-emerald-300">{f.ganadas}</span> · <span className="text-rose-300">{f.perdidas}</span> · {f.pendientes}
                <span className="sr-only"> ganadas, perdidas y pendientes</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Los enlaces de un equipo de la liga con el rival y la jornada ya elegidos:
 * su ficha, sus goles en vídeo, su ABP y el plan de ese partido. Si no es de
 * nuestra liga (Atlético sub-19, un jugador suelto…), no se llama.
 */
function EnlacesEquipo({ nombre, rivales, hoy }: { nombre: string; rivales: JornadaRival[]; hoy: string }) {
  const filaRival = filaDelEquipo(rivales, nombre, hoy);
  const llaves = { equipo: nombre, id: filaRival?.id ?? "" };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link href={`/rivals?equipo=${encodeURIComponent(nombre)}`} title={`La plantilla de ${nombre}`} className={CHIP_ENLACE}>
        Ficha
      </Link>
      {/* 18/11/2026: en el pop-up de la portada, sin salir de las apuestas. */}
      <BotonGolesEnVideo equipo={nombre} title={`Los goles de ${nombre} en vídeo, de seguido o uno a uno`} className={CHIP_ENLACE}>
        ▶ Sus goles
      </BotonGolesEnVideo>
      <Link href={conRivalEnUrl("/scout-rival-abp", llaves)} title={`El balón parado de ${nombre}`} className={CHIP_ENLACE}>
        ABP
      </Link>
      {filaRival?.id && (
        <Link href={conRivalEnUrl("/match-preparation", llaves)} title={`El plan de partido contra ${nombre}`} className={CHIP_ENLACE}>
          Plan{filaRival.jornada ? ` J${filaRival.jornada}` : ""}
        </Link>
      )}
    </div>
  );
}

/**
 * 18/11/2026 (análisis y marketing, ronda 22): un solo recuento por apuesta.
 * 18/11/2026 (ronda 23): con menos de 6 votos manda la cuenta («1 a favor ·
 * 2 en contra · faltan 8») y no se dan porcentajes; desde 6, el porcentaje
 * con su base debajo. La barra, siempre.
 */
const MINIMO_PORCENTAJE = 6;

function Recuento({ favor, contra, juegan, faltan }: { favor: number; contra: number; juegan: number; faltan: number }) {
  const total = favor + contra;
  const pFavor = total > 0 ? Math.round((favor / total) * 100) : 0;
  const pContra = total > 0 ? 100 - pFavor : 0;
  const conPorcentaje = total >= MINIMO_PORCENTAJE;
  const cuenta = `${favor} a favor · ${contra} en contra${faltan > 0 ? ` · ${faltan === 1 ? "falta 1" : `faltan ${faltan}`}` : ""}`;

  return (
    <div aria-label={conPorcentaje ? `${pFavor} % a favor y ${pContra} % en contra; ${cuenta}` : cuenta}>
      {conPorcentaje ? (
        <div className="flex items-baseline justify-between gap-2 text-[13px] font-semibold tabular-nums">
          <span className="text-emerald-300">{pFavor} % a favor</span>
          <span className="text-rose-300">{pContra} % en contra</span>
        </div>
      ) : (
        <p className="text-[14px] font-semibold tabular-nums">
          <span className="text-emerald-300">{favor} a favor</span>
          <span className="text-white/50"> · </span>
          <span className="text-rose-300">{contra} en contra</span>
          {faltan > 0 && <span className="text-white/70"> · {faltan === 1 ? "falta 1" : `faltan ${faltan}`}</span>}
        </p>
      )}
      {/* 27/11/2026 (marketing, ronda 9): el número dentro de cada tramo, para leerla sin la línea de arriba (si el tramo es muy corto, no cabe y no se pinta). */}
      <div className="mt-1 flex h-4 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
        <span className="siempre-oscuro flex h-full items-center justify-center bg-emerald-400 text-[10.5px] font-bold leading-none tabular-nums" style={{ width: `${pFavor}%`, color: "#0B0F14" }}>
          {favor > 0 && pFavor >= 12 ? favor : null}
        </span>
        <span className="siempre-oscuro flex h-full items-center justify-center bg-rose-400 text-[10.5px] font-bold leading-none tabular-nums" style={{ width: `${pContra}%`, color: "#0B0F14" }}>
          {contra > 0 && pContra >= 12 ? contra : null}
        </span>
      </div>
      {conPorcentaje && (
        <p className="mt-1 text-[12px] tabular-nums text-white/65">
          {favor} a favor y {contra} en contra · {juegan > 0 ? `${total} de ${juegan} ${total === 1 ? "ha" : "han"} apostado` : `${total} han apostado`}
        </p>
      )}
    </div>
  );
}

function Tarjeta({
  apuesta,
  juegan = [],
  yo,
  hoy,
  ocupado,
  pide,
  plantilla = [],
  rivales = [],
  desplegada = false,
  sello,
  sinEquipo = "",
}: {
  apuesta: Apuesta;
  plantilla?: Player[];
  /** Las filas de la hoja RIVALES: dan el ID con el que abre el plan. */
  rivales?: JornadaRival[];
  /** Quiénes pueden apostar (los de la quiniela): la base del «3 de 11». Vacío si no se sabe. */
  juegan?: string[];
  yo: string | null;
  hoy: string;
  ocupado: boolean;
  pide: (cuerpo: Record<string, unknown>, exito: string) => Promise<void>;
  /** Abierta de entrada (lo vivo). */
  desplegada?: boolean;
  /** Por qué está arriba («Se decide pronto», «La más disputada»). */
  sello?: string;
  /** Los enlaces del equipo ya van en la cabecera de su grupo. */
  sinEquipo?: string;
}) {
  const [abierta, setAbierta] = useState(desplegada);

  const estado = estadoDe(apuesta, hoy);

  const { favor, contra } = bandos(apuesta);

  const miPostura: Postura | null = yo ? (apuesta.posturas[yo] ?? null) : null;

  const soyAutor = yo === apuesta.autor;

  const puedoPosicionarme = puedePosicionarse(apuesta, yo, hoy);

  const puedoResolver = puedeResolverse(apuesta, yo, hoy);

  const puedoRetirar = puedeRetirarse(apuesta, yo);

  const ladoFavor = [apuesta.autor, ...favor];

  const dias = diasHasta(apuesta.comprobar, hoy);

  /* Retirarla la borra para siempre y no tiene deshacer: se pregunta. */
  const retira = async () => {
    if (!(await confirmar("¿Retirar esta apuesta? Se borra y no se puede recuperar."))) return;

    void pide({ accion: "retirar", id: apuesta.id }, "Apuesta retirada");
  };

  const postura = (nueva: Postura) =>
    void pide(
      { accion: "postura", id: apuesta.id, postura: miPostura === nueva ? null : nueva },
      miPostura === nueva ? "Te has quitado" : nueva === "favor" ? "Vas a favor" : "Vas en contra",
    );

  const veredicto = (dado: Veredicto | null) =>
    void pide(
      { accion: "veredicto", id: apuesta.id, veredicto: dado },
      dado === null ? "Veredicto deshecho" : dado === "acertada" ? "Acertada" : "Fallada",
    );

  const jugadores = jugadoresDe(apuesta.prediccion, plantilla);
  const equipos = equiposDe(apuesta.prediccion).filter((e) => e.nombre !== sinEquipo);

  const apostados = new Set([apuesta.autor, ...favor, ...contra]);
  const faltan = juegan.filter((slug) => !apostados.has(slug));

  return (
    <article
      className={`mr-8 flex flex-col gap-2.5 rounded-2xl border p-3 sm:mr-0 sm:p-3.5 ${
        estado === "acertada"
          ? "border-emerald-300/20 bg-emerald-300/[0.04]"
          : estado === "fallada"
            ? "border-rose-300/20 bg-rose-300/[0.04]"
            : "border-white/10 bg-white/[0.03]"
      }`}
    >
      {sello && (
        <span className="w-fit rounded-full bg-[#C8A96B]/15 px-2.5 py-0.5 text-[12px] font-semibold text-[#C8A96B]">{sello}</span>
      )}

      {/* La cabecera abre y cierra: la predicción, los días que faltan y la flecha. */}
      <button
        type="button"
        aria-expanded={abierta}
        onClick={() => setAbierta((v) => !v)}
        className="-m-1 flex items-start gap-3 rounded-xl p-1 text-left transition hover:bg-white/[0.03]"
      >
        <span className="fuente-club min-w-0 flex-1 text-[17px] font-bold leading-tight text-white sm:text-[19px]">
          «{apuesta.prediccion}»
        </span>
        {estado === "abierta" ? (
          <span className="shrink-0 text-right leading-tight">
            <span className="block text-[15px] font-bold tabular-nums text-[#C8A96B]">{dias === 1 ? "Mañana" : `${dias} días`}</span>
            <span className="block text-[12px] text-white/60">{fechaLarga(apuesta.comprobar)}</span>
          </span>
        ) : (
          <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[12px] font-semibold tabular-nums ${CHIP[estado].clase}`}>
            {CHIP[estado].texto}
          </span>
        )}
        <ChevronDown size={18} aria-hidden className={`mt-0.5 shrink-0 text-[#C8A96B] transition-transform ${abierta ? "rotate-180" : ""}`} />
      </button>

      <Recuento favor={ladoFavor.length} contra={contra.length} juegan={juegan.length} faltan={estado === "abierta" ? faltan.length : 0} />

      {/* 20/11/2026 (ronda 4, marketing): el veredicto esperado, por nombres: quién gana si ocurre y quién si no. */}
      {estado === "abierta" ? (
        <p className="text-[12.5px] leading-snug text-white/70">
          {/* 27/11/2026 (guionista): «acierta» con uno, «aciertan» con dos o más. */}
          <span className="font-semibold text-emerald-300">Si se cumple</span>, {ladoFavor.length === 1 ? "acierta" : "aciertan"} {enLista(ladoFavor.map(cortoDe))}
          {contra.length > 0 ? (
            <>
              {"; "}
              <span className="font-semibold text-rose-300">si no</span>, {enLista(contra.map(cortoDe))}
            </>
          ) : (
            "; si no, nadie se ha puesto en contra"
          )}
          .
        </p>
      ) : null}

      {/* Los enlaces: el jugador nuestro que nombra y el equipo de la liga, con el rival ya elegido. */}
      {(jugadores.length > 0 || equipos.length > 0) && (
        <div className="space-y-1.5">
          {jugadores.map(({ jugador, rotulo }) => (
            <div key={jugador.nombre} className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] font-semibold text-white/75">{rotulo}</span>
              <Link href={`/individual?nombre=${encodeURIComponent(jugador.nombre)}`} title={`La ficha de ${jugador.nombre} en Individual`} className={CHIP_ENLACE}>
                Ficha
              </Link>
              {esDeSeguimiento(jugador) && (
                <Link
                  href={`/individual?nombre=${encodeURIComponent(jugador.nombre)}&pestana=seguimiento`}
                  title={`El seguimiento de ${jugador.nombre}`}
                  className={CHIP_ENLACE}
                >
                  Su seguimiento
                </Link>
              )}
            </div>
          ))}
          {equipos.map((e) => (
            <div key={e.nombre} className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] font-semibold text-white/75">{e.nombre}</span>
              <EnlacesEquipo nombre={e.nombre} rivales={rivales} hoy={hoy} />
            </div>
          ))}
        </div>
      )}


      {/* Con sesión, los dos botones a la vista. */}
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
                className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-2 text-[13px] font-semibold transition disabled:cursor-wait disabled:opacity-60 ${tono}`}
              >
                <Icono size={15} aria-hidden /> {lado === "favor" ? "Apostar a favor" : "Apostar en contra"}
                {activo && <Check size={14} aria-label="vas aquí" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Al abrir: quién la lanzó, qué se juega, quién va a cada lado y quién falta. */}
      {abierta && (
        <div className="space-y-2.5 border-t border-white/[0.06] pt-2.5 text-[13px]">
          <p className="flex items-center gap-2 text-[12px] text-white/65">
            <Avatar slug={apuesta.autor} lado={22} />
            <span>
              La lanzó <span className="font-semibold text-white/90">{soyAutor ? "tú" : cortoDe(apuesta.autor)}</span> el {diaDe(apuesta.creadaEn)}
            </span>
          </p>

          {enJuegoReal(apuesta.enJuego) && (
            <p className="leading-snug text-white/75">
              <span className="font-semibold text-[#C8A96B]">Se juega:</span>{" "}
              <span className="text-[#E4CE9B]">{enJuegoReal(apuesta.enJuego)}</span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Lado gente={ladoFavor} tono="favor" yo={yo} />
            <Lado gente={contra} tono="contra" yo={yo} />
          </div>

          {/* 18/11/2026 (ronda 23): quién falta, como contador; los nombres, plegados. */}
          {estado === "abierta" && faltan.length > 0 && (
            /* 20/11/2026 (ronda 5, marketing): en las de «Se decide pronto», abierto. */
            <details className="group" open={desplegada || undefined}>
              <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-white/80 hover:text-white">
                <ChevronDown size={15} aria-hidden className="text-[#C8A96B] transition-transform group-open:rotate-180" />
                {faltan.length === 1 ? "Falta 1 por apostar" : `Faltan ${faltan.length} por apostar`}
                {yo && faltan.includes(yo) ? (faltan.length === 1 ? ": tú" : ", tú entre ellos") : ""}
              </summary>
              <p className="mt-1 text-[13px] leading-snug text-white/75">{faltan.map((slug) => (slug === yo ? "tú" : cortoDe(slug))).join(" · ")}</p>
            </details>
          )}
        </div>
      )}

      {/* ---------------------- el veredicto -------------------- */}

      {apuesta.veredicto ? (
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5 text-[12px] text-white/60">
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
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
          {puedoResolver ? (
            <span className="text-[12px] text-white/60">¿Qué ha pasado?</span>
          ) : (
            <span className="text-[12px] text-white/60">Espera veredicto</span>
          )}

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
      ) : puedoRetirar && abierta ? (
        <footer className="flex items-center justify-end border-t border-white/[0.06] pt-2.5">
          <Button icon={Trash2} disabled={ocupado} onClick={retira}>
            Retirarla
          </Button>
        </footer>
      ) : null}
    </article>
  );
}

/** Un lado de la apuesta al abrir la fila: caras y nombres cortos (la cifra ya va en la barra). */
function Lado({ gente, tono, yo }: { gente: string[]; tono: "favor" | "contra"; yo: string | null }) {
  const Icono = tono === "favor" ? ThumbsUp : ThumbsDown;
  const color = tono === "favor" ? "text-emerald-300" : "text-rose-300";

  return (
    <div className="min-w-0">
      <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${color}`}>
        <Icono size={13} aria-hidden />
        {tono === "favor" ? "A favor" : "En contra"}
      </span>
      {gente.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {gente.map((slug) => (
            <li key={slug} className="flex items-center gap-1.5 text-[12px] leading-tight text-white/80">
              <Avatar slug={slug} lado={20} />
              <span className="min-w-0 truncate">{slug === yo ? "tú" : cortoDe(slug)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[12px] text-white/55">Todavía nadie</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LA LÍNEA DE TIEMPO                                                */
/* ------------------------------------------------------------------ */

/**
 * 17/11/2026 (marketing, ronda 21): lo primero de la pantalla. Una parada por
 * bloque (30 días, Navidad, marzo, mayo, junio…) a la misma distancia, con una
 * barra de altura según cuántas se deciden ahí y la cifra encima; el bloque
 * más cargado, en oro lleno. El título es la conclusión («13 de las 19 se
 * deciden a fin de liga…»). Cada parada salta a su bloque (lo abre si está
 * plegado). Va con todas las vivas, sin el filtro de abajo. 18/11/2026 (ronda
 * 22): la próxima y la más disputada bajan a «Lo que se decide ya», en tarjeta.
 */
function LineaDeTiempo({
  paradas,
  total,
  onIr,
  elegida = null,
}: {
  paradas: (Grupo & { apuestas: Apuesta[] })[];
  total: number;
  onIr: (clave: string) => void;
  /** La parada que filtra las listas de abajo (20/11/2026, ronda 7). */
  elegida?: string | null;
}) {
  if (paradas.length === 0) return null;

  const maximo = Math.max(...paradas.map((p) => p.apuestas.length));
  /* La parada más cargada; a igualdad, la primera (la que antes llega). */
  const mayor = paradas.find((p) => p.apuestas.length === maximo) ?? paradas[0];
  const n = mayor.apuestas.length;
  const pendientes = paradas.find((p) => p.clave === "0")?.apuestas.length ?? 0;

  const conclusion =
    total === 1
      ? mayor.clave === "0"
        ? "La apuesta abierta espera veredicto"
        : `La apuesta abierta se decide ${mayor.frase}`
      : mayor.clave === "0"
        ? `${n} de las ${total} esperan veredicto`
        : n === total
          ? `Las ${total} se deciden ${mayor.frase}`
          : `${n} de las ${total} se ${n === 1 ? "decide" : "deciden"} ${mayor.frase}`;

  return (
    <section aria-labelledby="linea-tiempo-titulo" className="mt-5 min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#C8A96B]">Cuándo se decide cada una · pulsa para ver sólo ésas</p>
      <h2 id="linea-tiempo-titulo" className="fuente-club mt-1 text-[20px] font-bold leading-tight text-white sm:text-[24px]">
        {conclusion}
      </h2>

      <ol
        aria-label="Apuestas abiertas por cuándo se deciden"
        className="mt-4 grid"
        style={{ gridTemplateColumns: `repeat(${paradas.length}, minmax(0, 1fr))` }}
      >
        {paradas.map((p, i) => {
          const cuantas = p.apuestas.length;
          /* 18/11/2026 (ronda 23): raíz y mínimo visible, para que 1 y 3 no queden aplastados al lado de 13. */
          const alto = 14 + Math.round(Math.sqrt(cuantas / maximo) * 42);
          const esMayor = p.clave === mayor.clave;
          const esYa = p.clave === "0";
          const tramo = paradas.length === 1 ? "hidden" : i === 0 ? "left-1/2 right-0" : i === paradas.length - 1 ? "left-0 right-1/2" : "inset-x-0";

          return (
            <li key={p.clave} className="min-w-0">
              <button
                type="button"
                onClick={() => onIr(p.clave)}
                aria-pressed={elegida === p.clave}
                aria-label={`${p.titulo}: ${cuantas === 1 ? "1 apuesta" : `${cuantas} apuestas`}. ${elegida === p.clave ? "Quitar el filtro" : "Ver sólo éstas"}`}
                className={`group flex w-full flex-col items-center rounded-xl px-0.5 pb-1 pt-0.5 transition hover:bg-white/[0.04] ${
                  elegida === p.clave ? "bg-[#C8A96B]/[0.10] ring-1 ring-[#C8A96B]/60" : ""
                }`}
              >
                <span className="flex h-[76px] flex-col items-center justify-end">
                  <span className={`text-[15px] font-bold leading-none tabular-nums ${esMayor ? "text-white" : "text-white/80"}`}>{cuantas}</span>
                  <span
                    aria-hidden
                    /* 20/11/2026 (ronda 4): barras más anchas, que se vean y se pulsen. */
                    className={`mt-1 w-7 rounded-t sm:w-10 ${esYa ? "bg-sky-300" : esMayor ? "bg-[#C8A96B]" : "bg-[#C8A96B]/40"}`}
                    style={{ height: alto }}
                  />
                </span>
                <span aria-hidden className="relative flex h-4 w-full items-center justify-center">
                  <span className={`absolute top-1/2 h-px -translate-y-1/2 bg-white/20 ${tramo}`} />
                  <span className={`relative h-2.5 w-2.5 rounded-full border-2 ${esMayor ? "border-[#C8A96B] bg-[#C8A96B]" : "border-[#C8A96B]/70 bg-[#0B0F14]"}`} />
                </span>
                {/* 20/11/2026 (ronda 7, marketing): rótulos a 12-14 px. */}
                <span className={`mt-1 block max-w-full text-center text-[13px] font-semibold leading-tight sm:text-[14px] ${esMayor ? "text-white" : "text-white/80"} group-hover:text-white`}>
                  {p.corto}
                </span>
                <span className="block max-w-full text-center text-[12px] leading-tight text-white/65">{p.pie}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {pendientes > 0 && (
        <p className="mt-3 border-t border-white/[0.06] pt-3 text-[13px] leading-snug text-white/75">
          <span className="font-semibold text-sky-200">{pendientes === 1 ? "1 espera veredicto" : `${pendientes} esperan veredicto`}</span>: cualquiera que haya entrado puede darlo.
        </p>
      )}
    </section>
  );
}
