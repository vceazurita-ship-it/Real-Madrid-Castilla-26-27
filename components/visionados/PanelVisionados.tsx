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

function Barras({ titulo, filas, total }: { titulo: string; filas: [string, number][]; total: number }) {
  if (!filas.length) return null;
  /* Con pocas aperturas el porcentaje engaña: «3 de 8» y aviso de tendencia (09/11/2026). */
  const poca = total < 15;
  const max = filas[0][1];
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[#C8A96B]">
        {titulo}
        {poca && <span className="ml-2 text-xs font-normal normal-case tracking-normal italic text-white/55">tendencia: menos de 15 visionados</span>}
      </h3>
      <ul className="space-y-2">
        {filas.slice(0, 12).map(([nombre, n]) => (
          <li key={nombre} className="text-[13px]">
            <div className="mb-0.5 flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-white/85">{nombre}</span>
              <span className="shrink-0 tabular-nums text-white/70">{poca ? `${n} de ${total}` : `${n} · ${Math.round((100 * n) / total)} %`}</span>
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

  /* Los rangos que dan lo mismo que «Todo» no se ofrecen (los datos empiezan el 06/11). */
  const periodosUtiles = useMemo(() => {
    const cuantas = (dias: number) => (todos ?? []).filter((v) => !dias || ahora - new Date(v.cuando).getTime() <= dias * 86400000).length;
    const total = cuantas(0);
    return PERIODOS.filter((p) => p.dias === 0 || cuantas(p.dias) !== total);
  }, [todos, ahora]);

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

  /* Todos a una vez: es un empate, no un ranking. */
  const empate = clips.length > 1 && clips.every((c) => c.n === clips[0].n);

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

  /*
  | El resumen sólo con YouTube (11/11/2026, el analista): los jugadores ven
  | los clips en el canal, no en la app. Las aperturas de la app van aparte.
  */
  const resumen = useMemo(() => {
    const d = yt.datos;
    if (!d || !d.total) return null;
    const vistos = d.filas.filter((f) => f.vistas > 0).length;
    const sinVer = d.filas.length - vistos;
    const top = d.top && d.top.vistas > 0 ? d.top : null;
    return [
      { t: "Vistas en YouTube", v: String(d.total), base: `${d.filas.length} clips en el canal${d.nuevas ? ` · +${d.nuevas} desde la foto anterior` : ""}` },
      { t: "Clips vistos", v: String(vistos), base: `de ${d.filas.length} · mediana ${d.mediana} vistas por clip` },
      ...(sinVer ? [{ t: "Sin ver", v: `${sinVer} de ${d.filas.length}`, base: "clips del canal con 0 vistas: reenvíalos por WhatsApp" }] : []),
      ...(top ? [{ t: "El más visto", v: top.jugador || top.titulo, base: `${top.vistas} vistas${top.equipo ? ` · ${top.equipo}` : ""}`, texto: true }] : []),
    ].slice(0, 4);
  }, [yt.datos]);

  const cargando = todos === null || yt.resp === null;
  const nada = !cargando && !resumen;

  return (
    <div className="space-y-5">
      {/* Mientras nadie se identifique, un aviso único arriba y el campo a la vista (09/11/2026). */}
      {!guardado && !editando && (
        <p className="rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-2 text-sm text-white/85">
          Para saber quién ve cada clip, escribe tu nombre aquí abajo.
        </p>
      )}
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
          <span className="text-xs text-white/55">se guarda sólo en este aparato</span>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {resumen.map((k) => (
              <div key={k.t} className="min-w-0 rounded-2xl border border-[#C8A96B]/25 bg-white/[0.03] p-4">
                <p className="text-[12px] text-white/60">{k.t}</p>
                <p className={`${"texto" in k && k.texto ? "truncate text-xl" : "text-3xl"} font-black tabular-nums`}>{k.v}</p>
                <p className="text-xs text-white/55">{k.base}</p>
              </div>
            ))}
          </div>
        )
      )}

      <BloqueYoutube {...yt} />

      {!cargando && app.length > 0 && (
        <details className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <summary className="cursor-pointer select-none text-[14px] font-semibold text-white/75 hover:text-white">
            Aperturas desde la app <span className="font-normal text-white/50">· aparte: no cuentan en las cifras de YouTube</span>
          </summary>
          <div className="mt-3 space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
            <h2 className="text-xl font-bold">Dentro de la app</h2>
            <p className="text-[12px] text-white/55">Cada vez que alguien abre un clip en Clips, desde el {DESDE}.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {periodosUtiles.length > 1 && periodosUtiles.map((p) => (
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
              <p className="text-sm text-white/70">
                {lista.length} {lista.length === 1 ? "apertura" : "aperturas"} de {clips.length} {clips.length === 1 ? "clip distinto" : "clips distintos"}
                {clips.length === lista.length ? ", ninguno repetido" : ""}.
              </p>

              <div className="grid gap-4 lg:grid-cols-3">
                <Barras titulo="Quién los ve" filas={cuenta(lista, (v) => (conNombre(v.quien) ? v.quien : ""))} total={lista.length} />
                <Barras titulo="De qué puestos" filas={cuenta(lista, (v) => v.puesto)} total={lista.length} />
                <Barras titulo="De qué rivales" filas={cuenta(lista, (v) => v.equipo)} total={lista.length} />
              </div>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[#C8A96B]">{empate ? "Los clips abiertos" : "Los clips más abiertos"}</h3>
                <ol className="space-y-1.5 text-[13px]">
                  {clips.slice(0, 25).map(({ v, n, quien }, i) => (
                    <li key={v.video} className="flex flex-wrap items-baseline gap-x-2 border-b border-white/[0.06] pb-1.5">
                      {!empate && <span className="w-7 tabular-nums text-white/50">{i + 1}º</span>}
                      <span className="min-w-0 flex-1 text-white/85">{v.jugador || v.titulo} <span className="text-white/50">{[v.puesto, v.equipo].filter(Boolean).map((x) => ` · ${x}`).join("")}</span></span>
                      <span className="tabular-nums text-white/80">{n} {n === 1 ? "vez" : "veces"}</span>
                      {quien.size > 0 && <span className="w-full pl-9 text-[12px] text-white/50">Lo han visto: {[...quien].join(", ")}</span>}
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
          </div>
        </details>
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
