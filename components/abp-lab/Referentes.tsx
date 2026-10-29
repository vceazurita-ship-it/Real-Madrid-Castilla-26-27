"use client";

/**
 * Pestaña «Referentes»: quién es quién en el balón parado y qué se le puede
 * copiar. Todo sale de `lib/abp-lab/referentes.ts`, con su fuente debajo de
 * cada cosa; una rutina se lleva al taller con un botón.
 */

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAbpLigas, useProximoRival } from "@/hooks/useAbpLigas";
import { METRICA, equipoQueCasa, posicionEn, tablaDe } from "@/lib/abp-ligas/modelo";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { ArrowUpRight, BookOpen, CalendarClock, Check, ChevronDown, FlaskConical, GraduationCap, Library, Route, Search, Shield, Sparkles, Users, X } from "lucide-react";

import { Button, Panel } from "@/components/abp/ui";
import { useContextoLab } from "@/hooks/useContextoLab";
import { fechaFuente, type JugadorLab } from "@/components/abp-lab/comun";
import { MiniPizarra } from "@/components/abp-lab/PizarraRutina";
import { ESQUEMAS } from "@/lib/abp-lab/esquemas";
import { DATOS_CLAVE, DEFENSA, FUENTES as F, REFERENTES, type Fuente, type RutinaReferente } from "@/lib/abp-lab/referentes";
import { TIPOS, etiqueta } from "@/lib/abp-lab/modelo";

/* ------------------------------------------------------------------ */
/*  LA RUTA DE APRENDIZAJE                                             */
/* ------------------------------------------------------------------ */

/**
 * Lo gratuito, en el orden en que se aprovecha mejor: primero el marco (para
 * qué sirve el balón parado en el modelo), luego el dato, después cómo
 * atacan los mejores, cómo se defiende, el saque de banda y cómo se entrena.
 * Lo hecho se recuerda en este aparato.
 */
const RUTA: { fuente: Fuente; para: string }[] = [
  { fuente: F.coulston, para: "El marco: las cuatro preguntas antes de dibujar nada" },
  { fuente: F.analystCorners, para: "El dato: qué córner y qué zona dan más" },
  { fuente: F.plGabriel, para: "Arsenal: bloqueos, señuelos y un solo rematador" },
  { fuente: F.tggBloqueos, para: "El arte del bloqueo, paso a paso" },
  { fuente: F.fifaChelsea, para: "Chelsea: el córner en corto como ataque (con vídeo)" },
  { fuente: F.tfaChelsea, para: "Las rutinas de Cueva y por qué fallaban en la ejecución" },
  { fuente: F.plDefensa, para: "Defender: quién encaja menos y cómo se coloca" },
  { fuente: F.gronnemark, para: "El saque de banda: conservar y no sacar por la línea" },
  { fuente: F.georgson, para: "Entrenarlo: minutos a la semana y principios que crecen" },
  { fuente: F.vio, para: "Lo psicológico: variar para ser imprevisible" },
];

const CLAVE_RUTA = "abp-lab:ruta";

/*
 * La ruta vive en el almacenamiento del aparato y se lee con
 * `useSyncExternalStore`: en el servidor sale vacía y en el navegador con lo
 * guardado, sin desajuste al hidratar. Si no hay almacenamiento (ventana
 * privada), vale lo de esta sesión en memoria.
 */
const oyentesRuta = new Set<() => void>();

let rutaEnMemoria = "[]";

const leeRuta = () => {
  try {
    return window.localStorage.getItem(CLAVE_RUTA) ?? rutaEnMemoria;
  } catch {
    return rutaEnMemoria;
  }
};

const suscribeRuta = (aviso: () => void) => {
  oyentesRuta.add(aviso);
  window.addEventListener("storage", aviso);

  return () => {
    oyentesRuta.delete(aviso);
    window.removeEventListener("storage", aviso);
  };
};

function useRuta() {
  const crudo = useSyncExternalStore(suscribeRuta, leeRuta, () => "[]");

  const hechos = useMemo(() => {
    try {
      const v = JSON.parse(crudo);

      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }, [crudo]);

  const conmuta = (url: string) => {
    const nuevo = JSON.stringify(hechos.includes(url) ? hechos.filter((y) => y !== url) : [...hechos, url]);

    rutaEnMemoria = nuevo;

    try {
      window.localStorage.setItem(CLAVE_RUTA, nuevo);
    } catch {
      /* Vale para esta sesión. */
    }

    oyentesRuta.forEach((aviso) => aviso());
  };

  return { hechos, conmuta };
}

const normaliza = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const SIN_JUGADORES = new Map<string, JugadorLab>();

const DEFENSA_TEXTO = { zona: "en zona", hombre: "al hombre", mixta: "en mixta" } as const;

/** Por qué una rutina que funciona contra ese tipo de defensa encaja con el rival. */
const POR_QUE = {
  zona: "su zona no sigue a los que entran, así que un bloqueo deja al rematador sin marca",
  hombre: "cada uno va pegado a su par, y un bloqueo o un señuelo lo deja sin pareja",
  mixta: "los de zona y los de hombre se estorban entre sí, y un bloqueo por el lado ciego abre el hueco",
} as const;

/** «Contra quién funciona» y «Se entrena así… Éxito si…»: lo que convierte la rutina en una tarea. */
function TareaRutina({ r, plegable = false, porDato = false }: { r: RutinaReferente; plegable?: boolean; porDato?: boolean }) {
  const tarea = (
    <>
      <p>
        <span className="font-semibold text-white/85">Se entrena así:</span> {r.tarea}
      </p>
      <p>
        <span className="font-semibold text-white/85">Éxito si:</span> {r.exito.charAt(0).toLowerCase() + r.exito.slice(1)}
      </p>
    </>
  );

  return (
    <div className="mt-2 space-y-1 text-[12px] leading-snug text-white/65">
      {r.defensa && (
        <p>
          {porDato ? (
            /* 29/10/2026: elegida por el dato, no por su defensa: no se dice que el rival defienda así. */
            <><span className="font-semibold text-white/85">Funciona contra defensa {DEFENSA_TEXTO[r.defensa]}:</span> compruébalo en su vídeo de córners</>
          ) : (
            <><span className="font-semibold text-white/85">Contra quién funciona:</span> defensa {DEFENSA_TEXTO[r.defensa]}</>
          )}
        </p>
      )}
      {plegable ? (
        <details className="group">
          <summary className="cursor-pointer list-none text-[11.5px] font-semibold text-[#C8A96B] hover:underline [&::-webkit-details-marker]:hidden">
            Cómo se entrena <span className="group-open:hidden">(ver)</span>
            <span className="hidden group-open:inline">(ocultar)</span>
          </summary>
          <div className="mt-1 space-y-1">{tarea}</div>
        </details>
      ) : (
        tarea
      )}
    </div>
  );
}

/** Quién firma una rutina: una persona, o la escuela de un club (que se dice como tal). */
const firma = (r: { id: string; nombre: string; club: string }) => (r.id === "brentford" ? `${r.nombre} (club)` : `${r.nombre} · ${r.club}`);

/** Un número con un decimal y coma, como se escribe aquí. */
const coma = (v: number) => v.toFixed(1).replace(".", ",");

/**
 * «Esta semana, contra [rival]»: sale siempre que haya próximo rival. Si su
 * scouting dice cómo defiende el córner, se propone la rutina que encaja con esa
 * defensa; si no, se mira lo que concede a balón parado según Wyscout (valor por
 * partido, puesto en la liga y mediana) y se propone una rutina de córner de la
 * biblioteca: en corto si lo defienden bien, un bloqueo si les cuesta.
 */
function EstaSemana({ onAlTaller }: { onAlTaller: (rutina: RutinaReferente, referente: string) => void }) {
  const { rival } = useContextoLab();

  const proximo = useProximoRival();

  const { datos } = useAbpLigas();

  const nombre = rival?.equipo || proximo || "";

  const estructura = rival?.corner ?? null;

  const liga = useMemo(() => datos?.ligas.find((l) => equipoQueCasa(l, "Castilla")) ?? null, [datos]);

  const tabla = useMemo(() => (liga ? tablaDe(liga) : []), [liga]);

  const equipo = liga ? (liga.equipos.find((e) => mismoClub(e, nombre)) ?? "") : "";

  if (!nombre) return null;

  const concede = equipo ? posicionEn(tabla, equipo, METRICA.corPctC) : null;

  const volumen = equipo ? posicionEn(tabla, equipo, METRICA.corC) : null;

  const defensa = estructura ? (estructura.tipo === "zonal" ? "zona" : estructura.tipo) : null;

  const corners = REFERENTES.flatMap((r) => r.rutinas.map((x) => ({ r, x }))).filter(({ x }) => x.tipo === "corner");

  const porDefensa = defensa ? corners.find(({ x }) => x.defensa === defensa) : undefined;

  const duro = concede?.percentil != null && concede.percentil >= 67;

  /* 29/10/2026: los tres tonos de EncajeRival (p ≤ 33 les cuesta; 34-66 en la media; ≥ 67 lo defienden bien). */
  const tono = concede?.percentil == null ? "" : concede.percentil >= 67 ? "Lo defienden bien: " : concede.percentil <= 33 ? "Les cuesta: " : "En la media de la liga: ";

  const porDato = duro ? (corners.find(({ x }) => /corto/i.test(x.nombre)) ?? corners[0]) : (corners.find(({ x }) => /bloque/i.test(x.nombre)) ?? corners[0]);

  const encaje = porDefensa ?? (concede?.valor != null ? porDato : undefined);

  const { r, x } = encaje ?? { r: null, x: null };

  return (
    <section aria-label={`Esta semana, contra ${nombre}`} className="lab-aparece rounded-2xl border border-[#C8A96B]/30 bg-[#C8A96B]/[0.06] p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C8A96B]">
        <CalendarClock size={13} />
        Esta semana, contra {nombre}
      </p>
      {defensa && estructura && (
        <p className="mt-2 text-[13.5px] leading-snug text-white/75">
          {nombre} defiende el córner {DEFENSA_TEXTO[defensa]}
          {estructura.enZona ? ` (${estructura.enZona} en zona)` : ""}.
          {porDefensa && x ? (
            <>
              {" "}
              Prueba <span className="font-semibold text-white">{x.nombre}</span> ({r ? firma(r) : ""}). Por qué: {POR_QUE[defensa]}.
            </>
          ) : null}
        </p>
      )}
      {concede?.valor != null && concede.puesto != null && (
        <p className="mt-2 text-[13.5px] leading-snug text-white/75">
          {nombre} concede {coma(concede.valor)} remates de cada 100 córners en contra ({concede.puesto}.º de {concede.de}, donde el 1.º es el que menos concede
          {concede.mediana != null ? `; la mediana, ${coma(concede.mediana)}` : ""})
          {volumen?.valor != null ? ` y regala ${coma(volumen.valor)} córners por partido` : ""}. Wyscout, {liga?.nombre}.
          {!porDefensa && x ? (
            <>
              {" "}
              {tono}prueba <span className="font-semibold text-white">{x.nombre}</span> ({r ? firma(r) : ""}).
            </>
          ) : null}
        </p>
      )}
      {x && r && (
        <>
          <TareaRutina r={x} porDato={!porDefensa} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Cita fuente={x.fuente} />
            <Button icon={FlaskConical} onClick={() => onAlTaller(x, r.id)}>
              Al taller
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function Cita({ fuente }: { fuente: Fuente }) {
  return (
    <a
      href={fuente.url}
      target="_blank"
      rel="noreferrer"
      className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate text-[10.5px] text-white/40 underline-offset-2 hover:text-[#C8A96B] hover:underline"
    >
      <ArrowUpRight size={11} className="shrink-0" />
      <span className="truncate">
        {fuente.medio}
        {fuente.fecha ? ` · ${fechaFuente(fuente.fecha)}` : ""}
      </span>
    </a>
  );
}

export function Referentes({ onAlTaller }: { onAlTaller: (rutina: RutinaReferente, referente: string) => void }) {
  const [elegido, setElegido] = useState(REFERENTES[0].id);

  const [busca, setBusca] = useState("");

  const ruta = useRuta();

  const ref = REFERENTES.find((r) => r.id === elegido) ?? REFERENTES[0];

  /* Todo lo que se puede buscar: principios y rutinas de cada referente, y la defensa de la liga. */
  const resultados = useMemo(() => {
    const q = normaliza(busca.trim());

    if (q.length < 2) return [];

    const todo = [
      ...REFERENTES.flatMap((r) => [
        ...r.principios.map((p) => ({ clave: `${r.id}-p-${p.titulo}`, de: r.nombre, refId: r.id, titulo: p.titulo, texto: p.detalle, fuente: p.fuente })),
        ...r.rutinas.map((x) => ({ clave: `${r.id}-r-${x.id}`, de: r.nombre, refId: r.id, titulo: x.nombre, texto: x.pasos.join(" "), fuente: x.fuente })),
      ]),
      ...DEFENSA.map((p) => ({ clave: `def-${p.titulo}`, de: "Defender en la élite", refId: "", titulo: p.titulo, texto: p.detalle, fuente: p.fuente })),
    ];

    return todo.filter((x) => normaliza(`${x.titulo} ${x.texto} ${x.de}`).includes(q));
  }, [busca]);

  const [todosLosDatos, setTodosLosDatos] = useState(false);

  const [soloDe, setSoloDe] = useState("");

  const [tarjeta, setTarjeta] = useState(0);

  const carrusel = useRef<HTMLDivElement>(null);

  const biblioteca = REFERENTES.flatMap((r) => r.rutinas.map((x) => ({ r, x }))).filter(({ r }) => !soloDe || r.id === soloDe);

  const alScroll = () => {
    const c = carrusel.current;

    if (!c || !c.firstElementChild) return;

    const ancho = (c.firstElementChild as HTMLElement).offsetWidth + 12;

    setTarjeta(Math.min(biblioteca.length - 1, Math.max(0, Math.round(c.scrollLeft / ancho))));
  };

  const verEnBiblioteca = (id: string) => {
    setSoloDe(id);
    setTarjeta(0);
    carrusel.current?.scrollTo({ left: 0 });
    document.getElementById("biblioteca-rutinas")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-5">
      {/* ------------------------ BUSCADOR -------------------------------- */}
      <label className="relative block max-w-xl">
        <span className="sr-only">Buscar en los referentes</span>
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar: bloqueo, portero, corto, barrera, segundo palo…"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-10 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#C8A96B]/50"
        />
        {busca && (
          <button type="button" aria-label="Borrar la búsqueda" onClick={() => setBusca("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/40 hover:text-white">
            <X size={14} />
          </button>
        )}
      </label>

      {busca.trim().length >= 2 && (
        <section aria-live="polite" className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
            {resultados.length ? `${resultados.length} ${resultados.length === 1 ? "resultado" : "resultados"}` : "Nada con esa palabra: prueba con otra"}
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {resultados.slice(0, 12).map((x) => (
              <article key={x.clave} className="lab-aparece min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C8A96B]">{x.de}</p>
                <p className="mt-1 text-sm font-semibold text-white/90">{x.titulo}</p>
                <p className="mt-0.5 line-clamp-3 text-[12.5px] leading-snug text-white/60">{x.texto}</p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <Cita fuente={x.fuente} />
                  {x.refId && (
                    <button
                      type="button"
                      onClick={() => {
                        setElegido(x.refId);
                        setBusca("");
                      }}
                      className="text-[11px] font-semibold text-white/55 underline-offset-2 hover:text-white hover:underline"
                    >
                      Ver su ficha
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------ ESTA SEMANA ------------------------------ */}
      <EstaSemana onAlTaller={onAlTaller} />

      {/* ------------------------ EL DATO DE FONDO ------------------------- */}
      <section aria-label="El dato de fondo" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">El dato de fondo</p>
          <button
            type="button"
            aria-expanded={todosLosDatos}
            onClick={() => setTodosLosDatos((v) => !v)}
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-white/55 hover:text-white"
          >
            {todosLosDatos ? "Ver menos" : `Ver ${DATOS_CLAVE.length - 3} más`}
            <ChevronDown size={13} className={todosLosDatos ? "rotate-180" : ""} />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {DATOS_CLAVE.map((d, i) => (
            <div key={d.texto} className={`lab-aparece min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${i >= 3 && !todosLosDatos ? "hidden" : ""}`}>
              <p className="tabular-nums text-3xl font-bold tracking-tight text-[#C8A96B]">{d.valor}</p>
              <p className="mt-1 text-[12.5px] leading-snug text-white/70">{d.texto}</p>
              <Cita fuente={d.fuente} />
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------ LA BIBLIOTECA --------------------------- */}
      <div id="biblioteca-rutinas" className="scroll-mt-32">
      <Panel title="Biblioteca de rutinas" subtitle="Las de los referentes, dibujadas a partir de su fuente: al taller llegan colocadas y listas para reproducir" icon={Library}>
        {soloDe && (
          <p className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-white/60">
            Sólo las de {REFERENTES.find((r) => r.id === soloDe)?.nombre}.
            <button type="button" onClick={() => setSoloDe("")} className="font-semibold text-[#C8A96B] underline-offset-2 hover:underline">
              Ver todas
            </button>
          </p>
        )}
        <p className="mb-2 text-right text-[11px] tabular-nums text-white/45 sm:hidden" aria-live="polite">
          {Math.min(tarjeta + 1, biblioteca.length)} de {biblioteca.length}
        </p>
        <div
          ref={carrusel}
          onScroll={alScroll}
          className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4"
        >
          {biblioteca.map(({ r, x }) => {
            const esquema = ESQUEMAS[x.id];

            return (
              <article key={x.id} className="lab-aparece flex w-[85%] shrink-0 snap-center flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] sm:w-auto sm:min-w-0 sm:shrink">
                {esquema && <MiniPizarra rutina={{ nombre: x.nombre, senal: "", tipo: x.tipo, lado: "ofensivo", contra: "cualquiera", roles: esquema.roles, balon: esquema.balon }} porId={SIN_JUGADORES} />}
                <div className="flex flex-1 flex-col p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C8A96B]">
                    {firma(r)}
                  </p>
                  <p className="mt-1 text-[13.5px] font-semibold leading-snug text-white/90">{x.nombre}</p>
                  <p className="mt-0.5 text-[11.5px] text-white/45">
                    {etiqueta(TIPOS, x.tipo)}
                    {x.contra ? ` · contra ${x.contra}` : ""}
                  </p>
                  <TareaRutina r={x} plegable />
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2.5">
                    <Cita fuente={x.fuente} />
                    <Button icon={FlaskConical} onClick={() => onAlTaller(x, r.id)}>
                      Al taller
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
      </div>

      {/* ------------------------ ELEGIR REFERENTE ------------------------ */}
      <div className="flex flex-wrap gap-2 pb-1" role="tablist" aria-label="Referentes">
        {REFERENTES.map((r) => {
          const activo = r.id === elegido;

          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setElegido(r.id)}
              className={`shrink-0 rounded-2xl border px-4 py-2.5 text-left transition ${r.id === "brentford" ? "border-dashed " : ""}${
                activo ? "border-[#C8A96B]/60 bg-[#C8A96B]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <span className={`flex items-center gap-1.5 text-sm font-semibold ${activo ? "text-[#C8A96B]" : "text-white/85"}`}>
                {r.id === "brentford" && <Users size={13} aria-hidden />}
                {r.nombre}
              </span>
              {r.id === "brentford" ? <span className="block text-[11px] text-white/45">Córners del Brentford, de Jover y Georgson</span> : r.club !== r.nombre && <span className="block text-[11px] text-white/45">{r.club}</span>}
            </button>
          );
        })}
      </div>

      {/* ------------------------ LA FICHA -------------------------------- */}
      <section key={ref.id} className="lab-aparece overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="relative px-5 py-6 sm:px-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#C8A96B]/10 blur-3xl" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#C8A96B]">{ref.rol}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{ref.nombre}</h2>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-white/70">{ref.lema}</p>

          {ref.cifras.length > 0 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ref.cifras.map((c) => (
                <div key={c.texto} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                  <p className="tabular-nums text-2xl font-bold text-white">{c.valor}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-white/55">{c.texto}</p>
                  <Cita fuente={c.fuente} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-5 border-t border-white/10 px-5 py-6 sm:px-8 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
              <Sparkles size={13} className="text-[#C8A96B]" />
              Principios
            </h3>
            <ol className="mt-3 space-y-3">
              {ref.principios.map((p, i) => (
                <li key={p.titulo} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C8A96B]/15 text-[11px] font-bold text-[#C8A96B]">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white/90">{p.titulo}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-white/60">{p.detalle}</p>
                    <Cita fuente={p.fuente} />
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="min-w-0 space-y-4">
            {ref.rutinas.length > 0 && (
              <button
                type="button"
                onClick={() => verEnBiblioteca(ref.id)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/[0.08] px-3.5 py-2.5 text-[13px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/15"
              >
                <Library size={14} />
                Ver sus rutinas en la biblioteca
              </button>
            )}

            {ref.recursos.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  <GraduationCap size={13} className="text-[#C8A96B]" />
                  Para formarse
                </h3>
                <ul className="mt-3 space-y-2">
                  {ref.recursos.map((r) => (
                    <li key={r.url}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:border-[#C8A96B]/40"
                      >
                        <BookOpen size={15} className="shrink-0 text-[#C8A96B]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-white/85">{r.titulo}</span>
                          <span className="block truncate text-[11px] text-white/45">
                            {r.medio} · {r.tipo}
                            {r.fecha ? ` · ${fechaFuente(r.fecha)}` : ""}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            r.gratis ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/50"
                          }`}
                        >
                          {r.gratis ? "Gratis" : "De pago"}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------ RUTA DE APRENDIZAJE ---------------------- */}
      <Panel
        title="Ruta de aprendizaje"
        subtitle={`Todo gratis, en orden · ${RUTA.filter((x) => ruta.hechos.includes(x.fuente.url)).length} de ${RUTA.length} hechos`}
        icon={Route}
      >
        <div className="mb-4 flex items-center gap-1" role="img" aria-label={`Ruta: ${RUTA.filter((x) => ruta.hechos.includes(x.fuente.url)).length} de ${RUTA.length}`}>
          {RUTA.map((x) => (
            <span key={x.fuente.url} className={`h-1.5 flex-1 rounded-full ${ruta.hechos.includes(x.fuente.url) ? "bg-[#C8A96B]" : "bg-white/10"}`} />
          ))}
        </div>
        <ol className="grid gap-2 md:grid-cols-2">
          {RUTA.map((x, i) => {
            const hecho = ruta.hechos.includes(x.fuente.url);

            return (
              <li key={x.fuente.url} className={`flex min-w-0 items-start gap-3 rounded-xl border p-3 transition ${hecho ? "border-[#C8A96B]/40 bg-[#C8A96B]/[0.06]" : "border-white/10 bg-white/[0.02]"}`}>
                <button
                  type="button"
                  aria-pressed={hecho}
                  aria-label={hecho ? `Marcar «${x.para}» como pendiente` : `Marcar «${x.para}» como hecho`}
                  onClick={() => ruta.conmuta(x.fuente.url)}
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition ${hecho ? "bg-[#C8A96B] text-black" : "bg-white/10 text-white/55 hover:bg-white/20"}`}
                >
                  {hecho ? <Check size={13} /> : i + 1}
                </button>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-snug text-white/90">{x.para}</p>
                  <a href={x.fuente.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[11.5px] text-white/50 underline-offset-2 hover:text-[#C8A96B] hover:underline">
                    <ArrowUpRight size={11} className="shrink-0" />
                    <span className="truncate">
                      {x.fuente.medio}
                      {x.fuente.fecha ? ` · ${fechaFuente(x.fuente.fecha)}` : ""}
                    </span>
                  </a>
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>

      {/* ------------------------ DEFENDER -------------------------------- */}
      <Panel title="Cómo se defiende en la élite" subtitle="Lo que hacen los equipos que menos encajan de córner" icon={Shield}>
        <div className="grid gap-3 md:grid-cols-2">
          {DEFENSA.map((p) => (
            <div key={p.titulo} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              <p className="text-sm font-semibold text-white/90">{p.titulo}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-white/60">{p.detalle}</p>
              <Cita fuente={p.fuente} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
