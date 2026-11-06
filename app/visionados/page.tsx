"use client";

/*
| QUIÉN VE LOS CLIPS INDIVIDUALES DEL RIVAL (06/11/2026)
|
| Lo apunta Scout Individual cada vez que se abre un clip (/api/visionados).
| Quién: el administrador por su sesión; los demás, si este aparato ha dicho
| su nombre aquí. Si no se sabe quién, se ve igual qué vídeos y qué puestos
| se están mirando.
*/

import { useEffect, useMemo, useState } from "react";
import { Eye, UserRound } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { BloqueYoutube } from "./BloqueYoutube";

type Visionado = { cuando: string; video: string; titulo: string; equipo: string; jugador: string; puesto: string; quien: string };

const PERIODOS = [
  { clave: "7", nombre: "Últimos 7 días", dias: 7 },
  { clave: "30", nombre: "Últimos 30 días", dias: 30 },
  { clave: "todo", nombre: "Todo", dias: 0 },
] as const;

function cuenta<T extends string>(lista: Visionado[], clave: (v: Visionado) => T) {
  const m = new Map<T, number>();
  for (const v of lista) m.set(clave(v), (m.get(clave(v)) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
}

function Barras({ titulo, filas, total }: { titulo: string; filas: [string, number][]; total: number }) {
  if (!filas.length) return null;
  const max = filas[0][1];
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[#C8A96B]">{titulo}</h2>
      <ul className="space-y-2">
        {filas.slice(0, 12).map(([nombre, n]) => (
          <li key={nombre} className="text-[13px]">
            <div className="mb-0.5 flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-white/85">{nombre}</span>
              <span className="shrink-0 tabular-nums text-white/70">{n} · {Math.round((100 * n) / total)} %</span>
            </div>
            <span className="block h-2 rounded-full bg-white/10"><span className="block h-full rounded-full bg-[#C8A96B]" style={{ width: `${(100 * n) / max}%` }} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Visionados() {
  const [todos, setTodos] = useState<Visionado[] | null>(null);
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]["clave"]>("30");
  const [rival, setRival] = useState("");
  const [nombre, setNombre] = useState("");
  const [guardado, setGuardado] = useState("");

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

  const rivales = useMemo(() => [...new Set((todos ?? []).map((v) => v.equipo).filter(Boolean))].sort(), [todos]);
  const clips = useMemo(() => {
    const m = new Map<string, { v: Visionado; n: number; quien: Set<string> }>();
    for (const v of lista) {
      const e = m.get(v.video) ?? { v, n: 0, quien: new Set<string>() };
      e.n += 1;
      e.quien.add(v.quien);
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
  };

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <Topbar />
        <div className="space-y-5 p-4 sm:p-6 md:p-10">
          <header>
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">RMCF CASTILLA · SCOUTING</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Visionados de los clips del rival</h1>
            <p className="mt-2 max-w-2xl text-[14px] text-white/65">
              Cada clip individual que se abre en Scout Individual: quién lo ve, cuántas veces, de qué jugadores y de qué puestos. El administrador se reconoce solo; en los demás aparatos, di aquí tu nombre una vez.
            </p>
          </header>

          <BloqueYoutube />

          <h2 className="pt-4 text-xl font-bold">Dentro de la app (Scout Individual)</h2>

          <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <label className="min-w-0 flex-1">
              <span className="mb-1 flex items-center gap-1.5 text-[12px] text-white/60"><UserRound size={13} /> En este aparato ve los clips</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre (p. ej. Julián)" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[14px] text-white outline-none focus:border-[#C8A96B]/60" />
            </label>
            <button type="button" onClick={guardaNombre} disabled={nombre.trim() === guardado} className="rounded-xl border border-[#C8A96B]/50 px-4 py-2 text-[13px] font-semibold text-[#C8A96B] disabled:opacity-40">
              {guardado && nombre.trim() === guardado ? "Guardado" : "Guardar"}
            </button>
          </section>

          <div className="flex flex-wrap gap-2">
            {PERIODOS.map((p) => (
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

          {todos === null ? (
            <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" aria-label="Cargando" />
          ) : lista.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[14px] text-white/65">
              <Eye size={14} className="mr-1 inline" /> Todavía no se ha abierto ningún clip en este periodo. Se apunta desde el 06/11/2026, al abrir un clip en Scout Individual.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { t: "Visionados", v: lista.length },
                  { t: "Personas", v: new Set(lista.map((v) => v.quien)).size },
                  { t: "Clips distintos", v: clips.length },
                  { t: "Rivales", v: new Set(lista.map((v) => v.equipo)).size },
                ].map((k) => (
                  <div key={k.t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[12px] text-white/60">{k.t}</p>
                    <p className="text-3xl font-black tabular-nums">{k.v}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Barras titulo="Quién los ve" filas={cuenta(lista, (v) => v.quien)} total={lista.length} />
                <Barras titulo="De qué puestos" filas={cuenta(lista, (v) => v.puesto || "Puesto sin dato")} total={lista.length} />
                <Barras titulo="De qué rivales" filas={cuenta(lista, (v) => v.equipo || "Sin rival")} total={lista.length} />
              </div>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[#C8A96B]">Los clips más vistos</h2>
                <ol className="space-y-1.5 text-[13px]">
                  {clips.slice(0, 25).map(({ v, n, quien }, i) => (
                    <li key={v.video} className="flex flex-wrap items-baseline gap-x-2 border-b border-white/[0.06] pb-1.5">
                      <span className="w-7 tabular-nums text-white/50">{i + 1}º</span>
                      <span className="min-w-0 flex-1 text-white/85">{v.jugador || v.titulo} <span className="text-white/50">· {[v.puesto, v.equipo].filter(Boolean).join(" · ")}</span></span>
                      <span className="tabular-nums text-white/80">{n} {n === 1 ? "vez" : "veces"}</span>
                      <span className="w-full pl-9 text-[12px] text-white/50">Lo han visto: {[...quien].join(", ")}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[#C8A96B]">Últimos visionados</h2>
                <ul className="space-y-1 text-[13px]">
                  {[...lista].reverse().slice(0, 20).map((v, i) => (
                    <li key={i} className="flex flex-wrap gap-x-2 text-white/80">
                      <span className="tabular-nums text-white/50">{new Date(v.cuando).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      <b className="font-semibold">{v.quien}</b>
                      <span>{v.jugador || v.titulo}</span>
                      <span className="text-white/50">{[v.puesto, v.equipo].filter(Boolean).join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
