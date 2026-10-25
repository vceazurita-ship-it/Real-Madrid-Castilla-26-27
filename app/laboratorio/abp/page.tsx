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

const PESTANAS: { key: Pestana; label: string; icon: typeof Trophy; lema: string }[] = [
  { key: "referentes", label: "Referentes", icon: BookMarked, lema: "Lo que hacen los mejores" },
  { key: "jornada", label: "Lo mejor de cada jornada", icon: Target, lema: "Wyscout, cada mañana" },
  { key: "pizarra", label: "En la pizarra", icon: LayoutTemplate, lema: "Nuestras jugadas en uso" },
  { key: "taller", label: "Taller", icon: FlaskConical, lema: "Nuestras rutinas" },
  { key: "retos", label: "Retos", icon: Swords, lema: "La competición" },
];

export default function LaboratorioAbpPage() {
  const [pestana, setPestana] = useState<Pestana>("referentes");

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
        setPestana("pizarra");

        if (rutina) setBorrador({ ...rutina });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se ha podido traer la diapositiva");
      }
    },
    [doc.rutinas, guarda, porId, releePizarra],
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
      setPestana("pizarra");
      setLeePizarra(true);
    });
  }, []);

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
      setPestana("taller");
    });
  }, []);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
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
            <nav className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Secciones del laboratorio">
              {PESTANAS.map((p) => {
                const activa = p.key === pestana;

                const Icono = p.icon;

                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-current={activa ? "page" : undefined}
                    onClick={() => setPestana(p.key)}
                    className={`group flex min-w-0 items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                      activa ? "border-[#C8A96B]/60 bg-[#C8A96B]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${activa ? "bg-[#C8A96B]/20 text-[#C8A96B]" : "bg-white/5 text-white/50"}`}>
                      <Icono size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className={`block truncate text-sm font-semibold ${activa ? "text-[#C8A96B]" : "text-white/85"}`}>{p.label}</span>
                      <span className="block truncate text-[11px] text-white/45">{p.lema}</span>
                    </span>
                  </button>
                );
              })}
              <Link
                href="/laboratorio/abp/datos"
                className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 transition hover:bg-white/[0.06]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/50">
                  <BarChart3 size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white/85">Datos</span>
                  <span className="block truncate text-[11px] text-white/45">Primera RFEF y Premier</span>
                </span>
              </Link>
            </nav>

            {estado === "error" && (
              <div className="mt-5">
                <Notice tone="warn" title="No se ha podido leer el laboratorio">
                  Si la sesión de administrador ha caducado, vuelve a entrar desde Ajustes.
                </Notice>
              </div>
            )}

            <div className="mt-6">
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
                    setPestana("taller");
                  }}
                />
              )}

              {pestana === "jornada" && (
                <MejorJornada
                  onAlTaller={(b) => {
                    setBorrador(b);
                    setPestana("taller");
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
