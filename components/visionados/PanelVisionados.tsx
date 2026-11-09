"use client";

/*
| QUIÉN VE LOS CLIPS INDIVIDUALES DEL RIVAL (06/11/2026)
|
| Lo apunta Scout Individual cada vez que se abre un clip (/api/visionados).
| Quién: el administrador por su sesión; los demás, si este aparato ha dicho
| su nombre aquí. Si no se sabe quién, se ve igual qué vídeos y qué puestos
| se están mirando.
|
| 07/11/2026 (jueces 5–5,5): una sola frase de entrada (la da la cabecera);
| el nombre en una línea «Viendo como: X · cambiar»; arriba, tres cifras que
| juntan YouTube y la app con su base; sin nada que contar, un único vacío
| con «Ir a los clips» como botón. Cada cifra de la app lleva su periodo y
| una referencia (mediana de veces por clip).
*/

import { useEffect, useMemo, useState } from "react";
import { Eye, PlayCircle, UserRound } from "lucide-react";

import { BloqueYoutube, useDatosYoutube } from "./BloqueYoutube";

type Visionado = { cuando: string; video: string; titulo: string; equipo: string; jugador: string; puesto: string; quien: string };

const DESDE = "06/11/2026";
/** El servidor apunta «Sin identificar» cuando el aparato no ha dicho su nombre. */
const conNombre = (q: string) => Boolean(q) && q !== "Sin identificar";
const PERIODOS = [
  { clave: "7", nombre: "Últimos 7 días", dias: 7 },
  { clave: "30", nombre: "Últimos 30 días", dias: 30 },
  { clave: "todo", nombre: `Todo (desde el ${DESDE})`, dias: 0 },
] as const;

/** Lo que no tiene clave (puesto o rival sin dato) no se nombra. */
function cuenta(lista: Visionado[], clave: (v: Visionado) => string) {
  const m = new Map<string, number>();
  for (const v of lista) {
    const k = clave(v);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].sort((a, b) => b[1] - a[1]);
}

const mediana = (xs: number[]) => {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2);
};

function Barras({ titulo, filas, total }: { titulo: string; filas: [string, number][]; total: number }) {
  if (!filas.length) return null;
  const max = filas[0][1];
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[#C8A96B]">{titulo}</h3>
      <ul className="space-y-2">
        {filas.slice(0, 12).map(([nombre, n]) => (
          <li key={nombre} className="text-[13px]">
            <div className="mb-0.5 flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-white/85">{nombre}</span>
              <span className="shrink-0 tabular-nums text-white/70">{total < 15 ? `${n} de ${total}` : `${n} · ${Math.round((100 * n) / total)} %`}</span>
            </div>
            <span className="block h-2 rounded-full bg-white/10"><span className="block h-full rounded-full bg-[#C8A96B]" style={{ width: `${(100 * n) / max}%` }} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function IrALosClips({ principal = false }: { principal?: boolean }) {
  return (
    <a
      href="/scout-rival-individual?vista=clips"
      className={principal
        ? "inline-flex items-center gap-2 rounded-xl bg-[#C8A96B] px-4 py-2 text-[14px] font-semibold text-[#0B0F14]"
        : "inline-flex items-center gap-1.5 rounded-xl border border-[#C8A96B]/50 px-3 py-1.5 text-[13px] font-semibold text-[#C8A96B]"}
    >
      <PlayCircle size={15} /> Ir a los clips
    </a>
  );
}

export function PanelVisionados() {
  const [todos, setTodos] = useState<Visionado[] | null>(null);
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]["clave"]>("30");
  const [rival, setRival] = useState("");
  const [nombre, setNombre] = useState("");
  const [guardado, setGuardado] = useState("");
  const [editando, setEditando] = useState(false);
  const yt = useDatosYoutube();

  useEffect(() => {
    let vivo = true;
    fetch("/api/visionados", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { visionados?: Visionado[] }) => vivo && setTodos(j.visionados ?? []))
      .catch(() => vivo && setTodos([]));
    try {
      const q = localStorage.getItem("rmcf:quien") ?? "";
      queueMicrotask(() => {
        if (vivo) {
          setNombre(q);
          setGuardado(q);
        }
      });
    } catch {
      /* sin almacenamiento */
    }
    return () => {
      vivo = false;
    };
  }, []);

  const [ahora] = useState(() => Date.now());
  const lista = useMemo(() => {
    const dias = PERIODOS.find((p) => p.clave === periodo)?.dias ?? 0;
    return (todos ?? []).filter((v) => (!dias || ahora - new Date(v.cuando).getTime() <= dias * 86400000) && (!rival || v.equipo === rival));
  }, [todos, periodo, rival, ahora]);

  /* Un rango que da las mismas aperturas que «Todo» no se ofrece (09/11/2026): los datos empiezan el 06/11. */
  const periodoUtil = (clave: string) => {
    if (clave === "todo") return true;
    const dias = PERIODOS.find((p) => p.clave === clave)?.dias ?? 0;
    const dentro = (todos ?? []).filter((v) => ahora - new Date(v.cuando).getTime() <= dias * 86400000).length;
    return dentro !== (todos ?? []).length || clave === periodo;
  };

  const rivales = useMemo(() => [...new Set((todos ?? []).map((v) => v.equipo).filter(Boolean))].sort(), [todos]);
  const clips = useMemo(() => {
    const m = new Map<string, { v: Visionado; n: number; quien: Set<string> }>();
    for (const v of lista) {
      const e = m.get(v.video) ?? { v, n: 0, quien: new Set<string>() };
      e.n += 1;
      if (conNombre(v.quien)) e.quien.add(v.quien);
      m.set(v.video, e);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [lista]);

  const guardaNombre = () => {
    try {
      if (nombre.trim()) localStorage.setItem("rmcf:quien", nombre.trim());
      else localStorage.removeItem("rmcf:quien");
    } catch {
      /* sin almacenamiento */
    }
    setGuardado(nombre.trim());
    setEditando(false);
  };

  /* Resumen de arriba: YouTube (acumulado) y la app (todo, desde el 06/11). */
  const app = useMemo(() => todos ?? [], [todos]);
  const resumen = useMemo(() => {
    const d = yt.datos;
    const vistasYt = d?.total ?? 0;
    if (!vistasYt && !app.length) return null;
    const vistos = new Set<string>([...(d?.filas ?? []).filter((f) => f.vistas > 0).map((f) => f.id), ...app.map((v) => v.video)]);
    const totalClips = d?.filas.length ?? 0;
    const personas = new Set(app.map((v) => v.quien).filter(conNombre)).size;
    const porClipApp = new Map<string, { n: number; v: Visionado }>();
    for (const v of app) porClipApp.set(v.video, { n: (porClipApp.get(v.video)?.n ?? 0) + 1, v });
    const topApp = [...porClipApp.values()].sort((a, b) => b.n - a.n)[0];
    const topYt = d?.top && d.top.vistas > 0 ? d.top : null;
    const top = topYt
      ? { nombre: topYt.jugador || topYt.titulo, base: `${topYt.vistas} vistas en YouTube${topYt.equipo ? ` · ${topYt.equipo}` : ""}` }
      : topApp
        ? { nombre: topApp.v.jugador || topApp.v.titulo, base: `${topApp.n} ${topApp.n === 1 ? "vez" : "veces"} en la app${topApp.v.equipo ? ` · ${topApp.v.equipo}` : ""}` }
        : null;
    return [
      { t: "Vistas", v: String(vistasYt + app.length), base: [vistasYt ? `${vistasYt} en YouTube` : "", app.length ? `${app.length} en la app` : ""].filter(Boolean).join(" · ") },
      { t: "Clips vistos", v: String(vistos.size), base: totalClips ? `de ${totalClips} en el canal` : "al menos una vez" },
      ...(personas ? [{ t: "Personas en la app", v: String(personas), base: `con nombre, desde el ${DESDE}` }] : []),
      ...(top ? [{ t: "El más visto", v: top.nombre, base: top.base, texto: true }] : []),
    ].slice(0, 3);
  }, [yt.datos, app]);

  const cargando = todos === null || yt.resp === null;
  const nada = !cargando && !resumen;

  return (
    <div className="space-y-5">
      {/* Quién mira en este aparato: una línea, no un bloque. */}
      {guardado && !editando ? (
        <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-white/65">
          <UserRound size={14} className="text-[#C8A96B]" /> Viendo como <b className="text-white/90">{guardado}</b> ·
          <button type="button" onClick={() => setEditando(true)} className="text-[#C8A96B] underline underline-offset-2">cambiar</button>
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardaNombre();
          }}
          className="flex flex-wrap items-center gap-2 text-[13px] text-white/65"
        >
          <UserRound size={14} className="text-[#C8A96B]" />
          <label htmlFor="quien-ve">Viendo como</label>
          <input id="quien-ve" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="tu nombre" className="w-36 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[13px] text-white outline-none focus:border-[#C8A96B]/60" />
          <button type="submit" disabled={!nombre.trim()} className="rounded-lg border border-[#C8A96B]/50 px-2.5 py-1 text-[12px] font-semibold text-[#C8A96B] disabled:opacity-40">Guardar</button>
          <span className="text-[11px] text-white/45">se guarda sólo en este aparato</span>
        </form>
      )}

      {cargando ? (
        <div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" aria-label="Cargando" />
      ) : nada ? (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-white/90"><Eye size={16} className="text-[#C8A96B]" /> Aún no hay visionados.</p>
            {yt.resp?.aviso && <p className="mt-1 text-[13px] text-white/60">{yt.resp.aviso}</p>}
          </div>
          <IrALosClips principal />
        </div>
      ) : (
        resumen && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {resumen.map((k) => (
              <div key={k.t} className="min-w-0 rounded-2xl border border-[#C8A96B]/25 bg-white/[0.03] p-4">
                <p className="text-[12px] text-white/60">{k.t}</p>
                <p className={`${"texto" in k && k.texto ? "truncate text-xl" : "text-3xl"} font-black tabular-nums`}>{k.v}</p>
                <p className="text-[11px] text-white/45">{k.base}</p>
              </div>
            ))}
          </div>
        )
      )}

      <BloqueYoutube {...yt} />

      {!cargando && app.length > 0 && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
            <h2 className="text-xl font-bold">Dentro de la app</h2>
            <p className="text-[12px] text-white/55">Cada vez que alguien abre un clip en Clips, desde el {DESDE}.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {PERIODOS.filter((p) => periodoUtil(p.clave)).map((p) => (
              <button key={p.clave} type="button" onClick={() => setPeriodo(p.clave)} className={`rounded-full border px-3 py-1 text-[13px] ${periodo === p.clave ? "border-[#C8A96B] bg-[#C8A96B]/15 font-semibold text-[#C8A96B]" : "border-white/10 text-white/70"}`}>
                {p.nombre}
              </button>
            ))}
            {rivales.length > 1 && (
              <select value={rival} onChange={(e) => setRival(e.target.value)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[13px] text-white/80" aria-label="Rival">
                <option value="" className="bg-[#11161C]">Todos los rivales</option>
                {rivales.map((r) => <option key={r} value={r} className="bg-[#11161C]">{r}</option>)}
              </select>
            )}
          </div>

          {lista.length === 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[14px] text-white/70">
              <Eye size={15} className="text-[#C8A96B]" /> En este periodo nadie ha abierto un clip desde la app.
              <IrALosClips />
            </div>
          ) : (
            <>
              <p className="text-[14px] text-white/75">
                <b className="text-white">{lista.length}</b> {lista.length === 1 ? "apertura" : "aperturas"} de{" "}
                <b className="text-white">{clips.length}</b> {clips.length === 1 ? "clip" : "clips"}
                {clips.length === lista.length ? ", ninguno repetido" : `, mediana de ${mediana(clips.map((c) => c.n))} por clip`}
                {yt.datos ? ` · ${clips.length} de ${yt.datos.filas.length} en el canal` : ""}
                {lista.length < 15 ? <span className="text-white/50"> · tendencia: menos de 15 visionados</span> : null}
              </p>

              <div className="grid gap-4 lg:grid-cols-3">
                {lista.some((v) => conNombre(v.quien)) ? (
                  <Barras titulo="Quién los ve" filas={cuenta(lista, (v) => (conNombre(v.quien) ? v.quien : ""))} total={lista.length} />
                ) : (
                  <section className="min-w-0 rounded-2xl border border-[#C8A96B]/30 bg-[#C8A96B]/[0.06] p-4 text-[13px] text-white/80">
                    <h3 className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-[#C8A96B]">Quién los ve</h3>
                    Pon tu nombre arriba, en «Viendo como», para que cuente quién ve cada clip.
                  </section>
                )}
                <Barras titulo="De qué puestos" filas={cuenta(lista, (v) => v.puesto)} total={lista.length} />
                <Barras titulo="De qué rivales" filas={cuenta(lista, (v) => v.equipo)} total={lista.length} />
              </div>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[#C8A96B]">{clips.length > 1 && clips.every((c) => c.n === clips[0].n) ? `${clips.length} clips vistos, ninguno por encima de los demás` : "Los clips más abiertos"}</h3>
                <ol className="space-y-1.5 text-[13px]">
                  {clips.slice(0, 25).map(({ v, n, quien }, i) => (
                    <li key={v.video} className="flex flex-wrap items-baseline gap-x-2 border-b border-white/[0.06] pb-1.5">
                      <span className="w-7 tabular-nums text-white/50">{clips.every((c) => c.n === clips[0].n) ? "·" : `${i + 1}º`}</span>
                      <span className="min-w-0 flex-1 text-white/85">{v.jugador || v.titulo} <span className="text-white/50">{[v.puesto, v.equipo].filter(Boolean).map((x) => ` · ${x}`).join("")}</span></span>
                      <span className="tabular-nums text-white/80">{n} {n === 1 ? "vez" : "veces"}</span>
                      {quien.size > 0 && <span className="w-full pl-9 text-[12px] text-white/50">Lo han visto: {[...quien].join(", ")}</span>}
                    </li>
                  ))}
                </ol>
              </section>

              {lista.length > clips.length && (
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[#C8A96B]">Últimos visionados</h3>
                <ul className="space-y-1 text-[13px]">
                  {[...lista].reverse().slice(0, 20).map((v, i) => (
                    <li key={i} className="flex flex-wrap gap-x-2 text-white/80">
                      <span className="tabular-nums text-white/50">{new Date(v.cuando).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      {v.quien && <b className="font-semibold">{v.quien}</b>}
                      <span>{v.jugador || v.titulo}</span>
                      <span className="text-white/50">{[v.puesto, v.equipo].filter(Boolean).join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              </section>
              )}
            </>
          )}
        </>
      )}

      {/* Hay YouTube pero nadie ha abierto un clip en la app: una línea, con el botón. */}
      {!cargando && !nada && app.length === 0 && (
        <p className="flex flex-wrap items-center gap-3 text-[13px] text-white/60">
          <Eye size={14} className="text-[#C8A96B]" /> Dentro de la app aún nadie ha abierto un clip.
          <IrALosClips />
        </p>
      )}
    </div>
  );
}
