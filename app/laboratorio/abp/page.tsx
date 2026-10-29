"use client";

/**
 * LABORATORIO DE ABP (20/10/2026) · sólo administrador.
 *
 * El sitio donde se inventa el balón parado del Castilla:
 * - **Referentes**: lo que hacen Jover (Arsenal), Cueva (Chelsea), Brentford,
 *   Georgson, Vio, Grønnemark y Coulston, con la fuente de cada cosa y lo que
 *   se puede estudiar gratis.
 * - **Lo mejor de cada jornada**: las cinco mejores acciones a balón parado de
 *   cada jornada de Primera RFEF, LaLiga, Segunda, Premier y Champions (Wyscout),
 *   con el resumen oficial de YouTube de cada partido.
 * - **En la pizarra**: las jugadas de la pizarra de ABP que usamos de verdad,
 *   traídas con «Abrir en el laboratorio» y con lo que dice la pizarra de
 *   cada una; vuelven con «Enviar a la pizarra» (`lib/abp-lab/puente-*.ts`).
 * - **Taller**: nuestras rutinas, de la idea al partido.
 * - **Retos**: la competición de la plantilla, con podio, rachas e insignias.
 * - **Datos**: el balón parado de Primera RFEF y la Premier en Wyscout
 *   (`/laboratorio/abp/datos`, su propia pantalla).
 *
 * El candado está en `layout.tsx` (servidor) y en el menú (`soloAdmin`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, BookMarked, FlaskConical, LayoutTemplate, Swords, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { AbpHeader, Notice } from "@/components/abp/ui";
import { traeDeLaPizarra } from "@/components/abp-lab/EnLaPizarra";
import { MejorJornada } from "@/components/abp-lab/MejorJornada";
import { Referentes } from "@/components/abp-lab/Referentes";
import { Retos } from "@/components/abp-lab/Retos";
import { Taller, borradorVacio, type Borrador } from "@/components/abp-lab/Taller";
import { useJugadoresLab } from "@/components/abp-lab/comun";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useAbpLab } from "@/hooks/useAbpLab";
import { usePizarraAbpLectura } from "@/hooks/usePizarraAbpLectura";
import { tituloVisible, type SlidePizarra, type TableroPizarra } from "@/lib/abp/pizarra";
import { rutinaDeEnlace } from "@/lib/abp-lab/enlace";
import { ESQUEMAS } from "@/lib/abp-lab/esquemas";
import type { Defensa } from "@/lib/abp-lab/modelo";
import { borraRecado, leeRecado } from "@/lib/abp-lab/puente-envio";

/** La defensa que cuenta la fuente («Southampton (cinco zonales, tres al hombre)» es mixta). */
function defensaDe(texto?: string): Defensa {
  const t = (texto ?? "").toLowerCase();

  const zona = /zona/.test(t);

  const hombre = /hombre/.test(t);

  return zona && hombre ? "mixta" : zona ? "zona" : hombre ? "hombre" : "cualquiera";
}

type Pestana = "referentes" | "jornada" | "pizarra" | "taller" | "retos";

const PESTANAS: { key: Pestana; label: string; corto: string; icon: typeof Trophy; lema: string }[] = [
  { key: "referentes", label: "Referentes", corto: "Referentes", icon: BookMarked, lema: "Lo que hacen los mejores" },
  { key: "jornada", label: "Lo mejor de cada jornada", corto: "Jornada", icon: Target, lema: "Wyscout, cada mañana" },
  { key: "pizarra", label: "En la pizarra", corto: "Pizarra", icon: LayoutTemplate, lema: "Nuestras jugadas en uso" },
  { key: "taller", label: "Taller", corto: "Taller", icon: FlaskConical, lema: "Nuestras rutinas" },
  { key: "retos", label: "Retos", corto: "Retos", icon: Swords, lema: "La competición" },
];

function esPestana(valor: string | null): valor is Pestana {
  return PESTANAS.some((p) => p.key === valor);
}

export default function LaboratorioAbpPage() {
  const [pestana, setPestana] = useState<Pestana>("referentes");

  /* Dónde empieza el contenido: al cambiar de sección se vuelve aquí, no al final de la anterior. */
  const contenido = useRef<HTMLDivElement>(null);

  /* Alto de la cabecera fija: es donde se pega la barra de secciones. */
  const [tope, setTope] = useState(97);

  const fila = useRef<HTMLDivElement>(null);

  /*
   * NAVEGACIÓN (25/10/2026). La sección va en la dirección (`?seccion=jornada`):
   * «atrás» vuelve a la sección anterior en vez de sacarte del laboratorio, al
   * recargar no se vuelve a Referentes y una sección se puede enlazar.
   */
  const irA = useCallback((p: Pestana, como: "push" | "replace" = "push") => {
    setPestana(p);

    const url = new URL(window.location.href);

    if (url.searchParams.get("seccion") !== p) {
      url.searchParams.set("seccion", p);

      if (p !== "jornada") url.searchParams.delete("vista");

      window.history[como === "push" ? "pushState" : "replaceState"]({ seccion: p }, "", url.pathname + url.search + url.hash);
    }

    const arriba = contenido.current?.getBoundingClientRect().top ?? 0;

    /* Sólo si ya se ha bajado: si el contenido está a la vista, no se mueve nada. */
    if (arriba < tope) window.scrollTo({ top: window.scrollY + arriba - tope - 70 });
  }, [tope]);

  useEffect(() => {
    const desdeUrl = () => {
      const s = new URLSearchParams(window.location.search).get("seccion");

      setPestana(esPestana(s) ? s : "referentes");
    };

    void Promise.resolve().then(desdeUrl);

    /* La cabecera de esta página lleva debajo la franja «Balón parado»: la barra se pega bajo su alto real, no bajo un número fijo. */
    const cabecera = document.querySelector("header");

    const mide = () => setTope(cabecera?.getBoundingClientRect().height ?? 0);

    const observador = cabecera ? new ResizeObserver(mide) : null;

    if (cabecera) observador?.observe(cabecera);

    window.addEventListener("popstate", desdeUrl);

    return () => {
      window.removeEventListener("popstate", desdeUrl);
      observador?.disconnect();
    };
  }, []);

  /* En el móvil la fila se desliza: la sección abierta siempre a la vista. */
  useEffect(() => {
    const caja = fila.current;

    const boton = caja?.querySelector<HTMLElement>('[aria-current="page"]');

    if (!caja || !boton) return;

    const izquierda = boton.offsetLeft - caja.offsetLeft;

    if (izquierda < caja.scrollLeft || izquierda + boton.offsetWidth > caja.scrollLeft + caja.clientWidth) {
      caja.scrollTo({ left: Math.max(0, izquierda - 16), behavior: "smooth" });
    }
  }, [pestana]);

  const [borrador, setBorrador] = useState<Borrador | null>(null);

  const { doc, estado, guarda } = useAbpLab();

  const { jugadores, porId } = useJugadoresLab();

  const ocupado = estado === "guardando";

  /*
   * «En la pizarra»: la pizarra de ABP se LEE (para saber si cada jugada
   * sigue allí y traer otras); no se escribe nunca desde aquí. Se lee al
   * entrar en esa pestaña o al llegar desde la pizarra.
   */
  const [leePizarra, setLeePizarra] = useState(false);

  const pizarra = usePizarraAbpLectura(leePizarra || pestana === "pizarra");

  const releePizarra = pizarra.recarga;

  const trae = useCallback(
    async (
      partidoId: string,
      tablero: Pick<TableroPizarra, "rival" | "jornada"> & { slides?: SlidePizarra[] },
      slide: SlidePizarra,
      extra?: { fecha?: string; titulo?: string; jugadores?: [string, { nombre: string; dorsal?: number }][] },
    ) => {
      try {
        const indice = tablero.slides?.findIndex((s) => s.id === slide.id) ?? -1;

        const titulo = extra?.titulo ?? (tablero.slides && indice >= 0 ? tituloVisible(tablero.slides, indice) : undefined);

        const jugadores = new Map(extra?.jugadores ?? slide.fichas.flatMap((f) => (porId.get(f.playerId) ? [[f.playerId, { nombre: porId.get(f.playerId)!.nombre, dorsal: porId.get(f.playerId)!.dorsal }] as const] : [])));

        const rutina = await traeDeLaPizarra(doc.rutinas, guarda, {
          slide,
          partidoId,
          rival: tablero.rival,
          ...(tablero.jornada ? { jornada: tablero.jornada } : {}),
          ...(extra?.fecha ? { fecha: extra.fecha } : {}),
          ...(titulo ? { titulo } : {}),
          jugadores,
          ahora: new Date().toISOString(),
        });

        releePizarra();
        irA("pizarra");

        if (rutina) setBorrador({ ...rutina });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se ha podido traer la diapositiva");
      }
    },
    [doc.rutinas, guarda, porId, releePizarra, irA],
  );

  /*
   * Llegada desde la pizarra: `?desdePizarra=<token>&partido=…&diapositiva=…`.
   * Se espera a tener el laboratorio leído (para no duplicar una que ya está)
   * y se procesa UNA vez. Si el recado no está —otro aparato—, la diapositiva
   * se busca en el documento de la pizarra.
   */
  const llegada = useRef<{ token: string; partido: string; diapositiva: string } | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);

    const partido = q.get("partido") ?? "";

    const diapositiva = q.get("diapositiva") ?? "";

    if (!partido || !diapositiva) return;

    llegada.current = { token: q.get("desdePizarra") ?? "", partido, diapositiva };

    window.history.replaceState(null, "", window.location.pathname);

    void Promise.resolve().then(() => {
      irA("pizarra", "replace");
      setLeePizarra(true);
    });
  }, [irA]);

  useEffect(() => {
    const l = llegada.current;

    if (!l || estado !== "listo") return;

    const recado = l.token ? leeRecado(l.token, "traida") : null;

    if (recado && recado.partidoId === l.partido && recado.slide.id === l.diapositiva) {
      llegada.current = null;

      void trae(recado.partidoId, { rival: recado.rival, jornada: recado.jornada }, recado.slide, { fecha: recado.fecha, titulo: recado.titulo, jugadores: recado.jugadores }).then(() =>
        borraRecado(l.token),
      );

      return;
    }

    /* Sin recado: de la pizarra guardada, en cuanto se haya leído. */
    if (!pizarra.tableros && !pizarra.error) return;

    llegada.current = null;

    const tablero = pizarra.tableros?.[l.partido];

    const slide = tablero?.slides.find((s) => s.id === l.diapositiva);

    if (!tablero || !slide) {
      void Promise.resolve().then(() =>
        toast.error("No se ha encontrado esa diapositiva en la pizarra", { description: "Puede que aún no se haya guardado: espera a que la pizarra diga «Guardado» y vuelve a pulsar «Abrir en el laboratorio»." }),
      );

      return;
    }

    void trae(l.partido, tablero, slide);
  }, [estado, pizarra.tableros, pizarra.error, trae]);

  /* Lo que la sección «En la pizarra» necesita del documento de la pizarra. */
  const enPizarra = useMemo(
    () => ({
      tableros: pizarra.tableros,
      error: pizarra.error,
      recarga: pizarra.recarga,
      onTrae: (partidoId: string, tablero: TableroPizarra, slide: SlidePizarra) => void trae(partidoId, tablero, slide),
    }),
    [pizarra.tableros, pizarra.error, pizarra.recarga, trae],
  );

  /* Un enlace compartido (`#rutina=…`) abre esa rutina en el taller, como borrador sin guardar. */
  useEffect(() => {
    if (!window.location.hash.includes("rutina=")) return;

    void rutinaDeEnlace(window.location.hash).then((r) => {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);

      if (!r) return;

      const { id: _id, creadaEn: _c, actualizadaEn: _a, ...borrador } = r;

      void _id;
      void _c;
      void _a;

      setBorrador({ ...borradorVacio(), ...borrador });
      irA("taller", "replace");
    });
  }, [irA]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          {/* lg:pr-16 (29/10/2026, fútbol): a 1440 px el ⋮ flotante se montaba
              sobre la esquina de «Biblioteca de rutinas». */}
          <div className="min-w-0 pl-4 pr-12 pb-28 pt-6 sm:px-6 sm:pb-6 lg:pl-10 lg:pr-16">
            <AbpHeader
              area="RMCF Castilla · Balón parado"
              title="Laboratorio de ABP"
              lead="Mira qué rutina encaja esta semana contra el próximo rival, ábrela en el taller y llévala al microciclo."
              aside={
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
                  <FlaskConical size={12} />
                  Sólo tú
                </span>
              }
            />

            {/* ------------------------ PESTAÑAS ------------------------------ */}
            {/*
              Pegada bajo la cabecera (25/10/2026): las secciones largas —lo
              mejor de cada jornada, el taller— obligaban a subir hasta arriba
              para cambiar. En el móvil es una fila que se desliza, en vez de
              seis tarjetas que se comían media pantalla.
            */}
            <nav
              className="sticky z-20 -mx-4 mt-5 border-b border-white/[0.06] bg-[#0B0F14]/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 lg:-ml-10 lg:-mr-16 lg:pl-10 lg:pr-16"
              style={{ top: tope }}
              aria-label="Secciones del laboratorio"
            >
              <div ref={fila} className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                {PESTANAS.map((p) => {
                  const activa = p.key === pestana;

                  const Icono = p.icon;

                  return (
                    <button
                      key={p.key}
                      type="button"
                      aria-current={activa ? "page" : undefined}
                      title={p.lema}
                      onClick={() => irA(p.key)}
                      className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                        activa ? "border-[#C8A96B]/60 bg-[#C8A96B]/15 text-[#C8A96B]" : "border-white/10 bg-white/[0.03] text-white/75 hover:bg-white/[0.07] hover:text-white"
                      }`}
                    >
                      <Icono size={15} />
                      <span className="sm:hidden">{p.corto}</span>
                      <span className="hidden sm:inline">{p.label}</span>
                    </button>
                  );
                })}
                <Link
                  href="/laboratorio/abp/datos"
                  title="Primera RFEF y Premier"
                  className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/[0.07] hover:text-white"
                >
                  <BarChart3 size={15} />
                  Datos
                </Link>
              </div>
            </nav>

            {/* Lo que es la sección abierta, en una línea: antes iba en cada tarjeta. */}
            <p ref={contenido} className="mt-3 text-xs text-white/45">
              {PESTANAS.find((p) => p.key === pestana)?.lema}
            </p>

            {estado === "error" && (
              <div className="mt-5">
                <Notice tone="warn" title="No se ha podido leer el laboratorio">
                  Si la sesión de administrador ha caducado, vuelve a entrar desde Ajustes.
                </Notice>
              </div>
            )}

            <div className="mt-4">
              {pestana === "referentes" && (
                <Referentes
                  onAlTaller={(rutina, referente) => {
                    /* Llega dibujada si tenemos su esquema, y con la defensa contra la que la cuenta su fuente. */
                    const esquema = ESQUEMAS[rutina.id];

                    setBorrador({
                      ...borradorVacio(),
                      nombre: rutina.nombre,
                      tipo: rutina.tipo,
                      contra: defensaDe(rutina.contra),
                      inspiracion: rutina.id || referente,
                      idea: rutina.pasos.map((p, i) => `${i + 1}. ${p}`).join("\n"),
                      ...(esquema ? { roles: esquema.roles.map((r) => ({ ...r })), balon: esquema.balon.map((p) => ({ ...p })) } : {}),
                    });
                    irA("taller");
                  }}
                />
              )}

              {pestana === "jornada" && (
                <MejorJornada
                  onAlTaller={(b) => {
                    setBorrador(b);
                    irA("taller");
                  }}
                />
              )}

              {pestana === "pizarra" && (
                <Taller
                  rutinas={doc.rutinas}
                  jugadores={jugadores}
                  porId={porId}
                  guarda={guarda}
                  ocupado={ocupado}
                  cargando={estado === "cargando"}
                  abierto={borrador}
                  setAbierto={setBorrador}
                  enPizarra={enPizarra}
                />
              )}

              {pestana === "taller" && (
                <Taller
                  rutinas={doc.rutinas}
                  jugadores={jugadores}
                  porId={porId}
                  guarda={guarda}
                  ocupado={ocupado}
                  cargando={estado === "cargando"}
                  abierto={borrador}
                  setAbierto={setBorrador}
                />
              )}

              {pestana === "retos" && <Retos doc={doc} jugadores={jugadores} porId={porId} guarda={guarda} ocupado={ocupado} cargando={estado === "cargando"} />}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
