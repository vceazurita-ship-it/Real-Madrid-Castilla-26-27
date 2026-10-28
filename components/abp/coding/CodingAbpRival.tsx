"use client";

/**
 * CODING DEL ABP DEL RIVAL (28/10/2026).
 *
 * Abre la carpeta de la jornada (`ABP\RIVAL\ABP - 10 CARTAGENA`) en el
 * navegador —File System Access, nada se sube— y deja cribar los ~120 clips
 * con el teclado (flujo del experto de vídeo): K se queda, D descarta, S lo
 * deja pendiente, Z deshace; el siguiente ya está cargado y arranca en bucle.
 * Lo decidido, las notas, las marcas y las etiquetas se guardan en
 * `abp-coding-rival:<carpeta>` en cada decisión. Al final: el texto para el
 * cuerpo técnico, los apuntes de la jornada y mover los descartados a
 * `_descartados` (confirmado; no se borra nada sin pedirlo).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCopy, FolderOpen, Keyboard, NotebookPen, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { APUNTES_KIND, APUNTES_RIVAL_VACIO, apuntesRivalKey, normalizaCuaderno, nuevoId, type ApuntesRivalDoc } from "@/lib/abp/apuntes";
import {
  CARPETAS,
  CODING_VACIO,
  GRUPOS,
  aApuntes,
  codingKey,
  etiquetasEnTexto,
  idClip,
  numeroDeArchivo,
  resumenDe,
  textoCoding,
  trayectoria,
  type CarpetaKey,
  type ClipEstado,
  type CodingDoc,
  type Estado,
  type GrupoKey,
} from "@/lib/abp/coding-rival";

/* ------------------------------------------------------------------ */
/*  LA CARPETA (y recordarla en IndexedDB para no pedirla otra vez)    */
/* ------------------------------------------------------------------ */

type Archivo = { n: number; handle: FileSystemFileHandle; dir: FileSystemDirectoryHandle; nombre: string };

type Abierta = { raiz: FileSystemDirectoryHandle; nombre: string; porCarpeta: Map<CarpetaKey, Archivo[]> };

const IDB = "rmcf-coding-abp";

function idb<T>(modo: IDBTransactionMode, hace: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return new Promise((ok) => {
    try {
      const pide = indexedDB.open(IDB, 1);

      pide.onupgradeneeded = () => pide.result.createObjectStore("h");
      pide.onerror = () => ok(undefined);
      pide.onsuccess = () => {
        const r = hace(pide.result.transaction("h", modo).objectStore("h"));

        r.onsuccess = () => ok(r.result as T);
        r.onerror = () => ok(undefined);
      };
    } catch {
      ok(undefined);
    }
  });
}

type ConPermiso = FileSystemDirectoryHandle & {
  queryPermission?: (o: { mode: string }) => Promise<string>;
  requestPermission?: (o: { mode: string }) => Promise<string>;
  entries?: () => AsyncIterable<[string, FileSystemHandle]>;
};

async function hijos(dir: FileSystemDirectoryHandle) {
  const lista: [string, FileSystemHandle][] = [];

  for await (const par of (dir as ConPermiso).entries!()) lista.push(par);

  return lista;
}

/** Lee la jornada: vale elegir «ABP - 10 CARTAGENA» o su subcarpeta «ABP». */
async function leeCarpeta(raiz: FileSystemDirectoryHandle): Promise<Abierta> {
  let base = raiz;

  const nivel = await hijos(raiz);

  if (!nivel.some(([n, h]) => h.kind === "directory" && CARPETAS.some((c) => c.key === n.toUpperCase()))) {
    const abp = nivel.find(([n, h]) => h.kind === "directory" && n.toUpperCase() === "ABP");

    if (abp) base = abp[1] as FileSystemDirectoryHandle;
  }

  const porCarpeta = new Map<CarpetaKey, Archivo[]>();

  for (const [nombre, h] of await hijos(base)) {
    const c = CARPETAS.find((x) => x.key === nombre.toUpperCase());

    if (!c || h.kind !== "directory") continue;

    const archivos: Archivo[] = [];

    for (const [f, fh] of await hijos(h as FileSystemDirectoryHandle)) {
      const n = numeroDeArchivo(f);

      if (fh.kind === "file" && n !== null && !f.startsWith("._")) archivos.push({ n, handle: fh as FileSystemFileHandle, dir: h as FileSystemDirectoryHandle, nombre: f });
    }

    porCarpeta.set(c.key, archivos.sort((a, b) => a.n - b.n));
  }

  return { raiz, nombre: raiz.name.toUpperCase() === "ABP" ? base.name : raiz.name, porCarpeta };
}

/** «ABP - 10 CARTAGENA» → { rival: "CARTAGENA", jornada: 10 }. */
function deLaCarpeta(nombre: string) {
  const m = /(\d+)\s*[-–]?\s*(.+)$/.exec(nombre.replace(/^ABP\s*-\s*/i, ""));

  return m ? { jornada: Number(m[1]), rival: m[2].trim() } : { jornada: null, rival: nombre.replace(/^ABP\s*-\s*/i, "").trim() };
}

/* ------------------------------------------------------------------ */
/*  EL VISOR                                                           */
/* ------------------------------------------------------------------ */

const VELOCIDADES = [0.25, 0.5, 1, 2];

const ATAJOS: [string, string][] = [
  ["K", "Me lo quedo"],
  ["D", "Descartar"],
  ["S", "Dejar pendiente"],
  ["Z", "Deshacer"],
  ["Espacio", "Play / pausa"],
  ["← →", "∓2 s"],
  [", .", "∓1 fotograma"],
  ["1-4", "0,25× · 0,5× · 1× · 2×"],
  ["M / N", "Marcar / ir al momento clave"],
  ["Enter", "Nota"],
  ["J / L", "Clip anterior / siguiente"],
  ["Q / W", "Carpeta anterior / siguiente"],
  ["R", "Revisar elegidos"],
  ["Tab (mantener)", "3× mientras lo pulsas"],
  ["?", "Todos los atajos"],
];

export function CodingAbpRival({ equipo }: { equipo: string | null }) {
  const [abierta, setAbierta] = useState<Abierta | null>(null);
  const [guardada, setGuardada] = useState<ConPermiso | null>(null);
  const [carpeta, setCarpeta] = useState<CarpetaKey>("CORNER OF");
  const [indice, setIndice] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [velocidad, setVelocidad] = useState(1);
  const [escribiendo, setEscribiendo] = useState(false);
  const [nota, setNota] = useState("");
  const [revision, setRevision] = useState(false);
  const [comparar, setComparar] = useState<string[]>([]);
  const [conResumen, setConResumen] = useState(true);
  const [ayuda, setAyuda] = useState(false);
  const [moviendo, setMoviendo] = useState(false);
  const [fallo, setFallo] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const deshacer = useRef<{ id: string; antes: ClipEstado | undefined; carpeta: CarpetaKey; indice: number }[]>([]);
  const precarga = useRef(new Map<string, string>());

  const clave = abierta ? codingKey(abierta.nombre) : "abp-coding-rival:_";

  const { value: doc, setValue: setDoc } = useRemoteDoc<CodingDoc>({ key: clave, kind: "abp-coding", fallback: CODING_VACIO });

  const { rival, jornada } = deLaCarpeta(abierta?.nombre ?? "");

  /* La carpeta de la última vez, si el navegador la recuerda. */
  useEffect(() => {
    void idb<ConPermiso>("readonly", (s) => s.get("ultima")).then((h) => h && setGuardada(h));
  }, []);

  const abre = async (h: ConPermiso) => {
    try {
      if (h.queryPermission && (await h.queryPermission({ mode: "readwrite" })) !== "granted") await h.requestPermission?.({ mode: "readwrite" });

      const a = await leeCarpeta(h);

      if (!a.porCarpeta.size) {
        toast.error("En esa carpeta no están CORNER OF, FALTA OF, SDB OF…");
        return;
      }

      void idb("readwrite", (s) => s.put(h, "ultima"));
      setAbierta(a);
      setCarpeta(CARPETAS.find((c) => a.porCarpeta.get(c.key)?.length)?.key ?? "CORNER OF");
      setIndice(0);
    } catch (error) {
      console.warn("[coding-abp] abrir carpeta", error);
    }
  };

  const elige = async () => {
    const picker = (window as unknown as { showDirectoryPicker?: (o: object) => Promise<ConPermiso> }).showDirectoryPicker;

    if (!picker) {
      toast.error("Este navegador no abre carpetas: usa Chrome o Edge en el ordenador");
      return;
    }

    try {
      await abre(await picker({ id: "abp-rival", mode: "readwrite" }));
    } catch {
      /* Cancelado. */
    }
  };

  const lista = useMemo(() => (abierta?.porCarpeta.get(carpeta) ?? []).filter((a) => !doc.clips[idClip(carpeta, a.n)]?.fuera), [abierta, carpeta, doc.clips]);

  const actual = lista[Math.min(indice, Math.max(0, lista.length - 1))] ?? null;

  const idActual = actual ? idClip(carpeta, actual.n) : "";

  const estadoDe = useCallback((id: string): ClipEstado => doc.clips[id] ?? { estado: "pendiente" }, [doc.clips]);

  /* La URL del clip (y la del siguiente, ya preparada). */
  const urlDe = useCallback(async (a: Archivo) => {
    const k = `${a.dir.name}/${a.nombre}`;

    const hecha = precarga.current.get(k);

    if (hecha) return hecha;

    const u = URL.createObjectURL(await a.handle.getFile());

    precarga.current.set(k, u);

    /* No más de 6 a la vez en memoria. */
    if (precarga.current.size > 6) {
      const [vieja, uv] = precarga.current.entries().next().value as [string, string];

      precarga.current.delete(vieja);
      URL.revokeObjectURL(uv);
    }

    return u;
  }, []);

  useEffect(() => {
    let vivo = true;

    if (!actual) return;

    void urlDe(actual).then((u) => vivo && (setUrl(u), setFallo("")));

    const siguiente = lista[indice + 1];

    if (siguiente) void urlDe(siguiente);

    return () => {
      vivo = false;
    };
  }, [actual, lista, indice, urlDe]);

  useEffect(() => {
    if (video.current) video.current.playbackRate = velocidad;
  }, [velocidad, url]);

  /* ------------------------------ decidir ------------------------------ */

  const cambia = useCallback(
    (id: string, cambio: Partial<ClipEstado>) => {
      setDoc((d) => ({ ...d, clips: { ...d.clips, [id]: { ...(d.clips[id] ?? { estado: "pendiente" }), ...cambio } }, actualizado: new Date().toISOString() }));
    },
    [setDoc],
  );

  const decide = (estado: Estado) => {
    if (!actual) return;

    deshacer.current.push({ id: idActual, antes: doc.clips[idActual], carpeta, indice });
    cambia(idActual, { estado });

    /* Al siguiente pendiente de la carpeta; si no queda, al siguiente sin más. */
    const resto = lista.findIndex((a, i) => i > indice && estadoDe(idClip(carpeta, a.n)).estado === "pendiente");

    setIndice(resto >= 0 ? resto : Math.min(indice + 1, lista.length - 1));
  };

  const deshaz = () => {
    const ultimo = deshacer.current.pop();

    if (!ultimo) return;

    setDoc((d) => {
      const clips = { ...d.clips };

      if (ultimo.antes) clips[ultimo.id] = ultimo.antes;
      else delete clips[ultimo.id];

      return { ...d, clips };
    });
    setCarpeta(ultimo.carpeta);
    setIndice(ultimo.indice);
  };

  const etiqueta = (grupo: GrupoKey, valor: string) => {
    if (!actual) return;

    const antes = estadoDe(idActual).etiquetas ?? {};

    cambia(idActual, { etiquetas: { ...antes, [grupo]: antes[grupo] === valor ? undefined : valor } });
  };

  const cambiaCarpeta = (paso: number) => {
    const conClips = CARPETAS.filter((c) => abierta?.porCarpeta.get(c.key)?.length);

    const i = conClips.findIndex((c) => c.key === carpeta);

    const otra = conClips[(i + paso + conClips.length) % conClips.length];

    if (otra) {
      setCarpeta(otra.key);
      setIndice(0);
    }
  };

  /* ------------------------------ teclado ------------------------------ */

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!abierta || escribiendo || e.ctrlKey || e.metaKey || e.altKey) return;

      const destino = e.target as HTMLElement | null;

      if (destino && (destino.tagName === "INPUT" || destino.tagName === "TEXTAREA" || destino.isContentEditable)) return;

      const v = video.current;

      const k = e.key.toLowerCase();

      /* Tab mantenido = 3× mientras se pulsa (experto de vídeo); al soltar, la velocidad elegida. */
      if (e.key === "Tab" && !revision) {
        e.preventDefault();
        if (v && !e.repeat) v.playbackRate = 3;
        return;
      }

      const acciones: Record<string, () => void> = {
        "?": () => setAyuda((a) => !a),
        k: () => decide("elegido"),
        d: () => decide("descartado"),
        s: () => decide("pendiente"),
        z: deshaz,
        " ": () => {
          if (v) void (v.paused ? v.play() : v.pause());
        },
        arrowleft: () => {
          if (v) v.currentTime = Math.max(0, v.currentTime - 2);
        },
        arrowright: () => {
          if (v) v.currentTime += 2;
        },
        ",": () => {
          if (!v) return;
          v.pause();
          v.currentTime -= 1 / 25;
        },
        ".": () => {
          if (!v) return;
          v.pause();
          v.currentTime += 1 / 25;
        },
        m: () => {
          if (v) cambia(idActual, { marca: Math.round(v.currentTime * 10) / 10 });
        },
        n: () => {
          if (!v) return;
          const m = estadoDe(idActual).marca;
          v.currentTime = Math.max(0, m !== undefined ? m - 2 : (v.duration || 0) * 0.4);
        },
        enter: () => {
          if (!actual) return;
          setNota(estadoDe(idActual).nota ?? "");
          setEscribiendo(true);
        },
        j: () => setIndice((i) => Math.max(0, i - 1)),
        l: () => setIndice((i) => Math.min(lista.length - 1, i + 1)),
        q: () => cambiaCarpeta(-1),
        w: () => cambiaCarpeta(1),
        r: () => setRevision((r) => !r),
        ...Object.fromEntries(VELOCIDADES.map((x, i) => [String(i + 1), () => setVelocidad(x)])),
      };

      const accion = acciones[k];

      if (!accion) return;

      e.preventDefault();
      accion();
    };

    const suelta = (e: KeyboardEvent) => {
      if (e.key === "Tab" && video.current) video.current.playbackRate = velocidad;
    };

    window.addEventListener("keydown", tecla);
    window.addEventListener("keyup", suelta);

    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("keyup", suelta);
    };
  });

  /* ------------------------------ cuentas ------------------------------ */

  const porCarpeta = useMemo(() => {
    const m = new Map<CarpetaKey, [number, ClipEstado][]>();

    for (const c of CARPETAS) m.set(c.key, (abierta?.porCarpeta.get(c.key) ?? []).map((a) => [a.n, doc.clips[idClip(c.key, a.n)] ?? { estado: "pendiente" }]));

    return m;
  }, [abierta, doc.clips]);

  const todos = [...porCarpeta.values()].flat();
  const total = todos.length;
  const elegidos = todos.filter(([, c]) => c.estado === "elegido").length;
  const decididos = todos.filter(([, c]) => c.estado !== "pendiente").length;
  const descartados = CARPETAS.flatMap((c) => (abierta?.porCarpeta.get(c.key) ?? []).filter((a) => doc.clips[idClip(c.key, a.n)]?.estado === "descartado" && !doc.clips[idClip(c.key, a.n)]?.fuera).map((a) => ({ c: c.key, a })));

  const texto = useMemo(() => textoCoding(rival || equipo || "", porCarpeta, conResumen), [rival, equipo, porCarpeta, conResumen]);

  /* --------------------------- apuntes y borrado --------------------------- */

  const { value: apuntes, setValue: setApuntes } = useRemoteDoc<ApuntesRivalDoc>({
    key: apuntesRivalKey(equipo ?? "_"),
    kind: APUNTES_KIND,
    fallback: APUNTES_RIVAL_VACIO,
  });

  const llevaApuntes = () => {
    if (!equipo || !jornada) return;

    const clave = `J${jornada}`;

    const cuaderno = normalizaCuaderno(apuntes?.jornadas?.[clave]);

    /* Los de clip se rehacen con lo de ahora; los de minuto (escritos a mano) se quedan. */
    const nuevos = aApuntes(porCarpeta, nuevoId);

    setApuntes((d) => ({ ...d, jornadas: { ...d.jornadas, [clave]: { ...cuaderno, apuntes: [...cuaderno.apuntes.filter((a) => a.ref?.clase !== "clip"), ...nuevos], actualizado: new Date().toISOString() } } }));

    toast.success(`${nuevos.length} apuntes en «Apuntes y vídeo» (J${jornada})`);
  };

  const mueveDescartados = async () => {
    if (!abierta || !descartados.length) return;

    if (!window.confirm(`Mover ${descartados.length} clips descartados a la carpeta «_descartados»? Desde ahí los borras tú cuando quieras.`)) return;

    setMoviendo(true);

    const fuera: string[] = [];

    let hechos = 0;

    try {
      const papelera = await abierta.raiz.getDirectoryHandle("_descartados", { create: true });

      for (const { c, a } of descartados) {
        try {
          const destino = await papelera.getDirectoryHandle(c, { create: true });

          const movible = a.handle as FileSystemFileHandle & { move?: (d: FileSystemDirectoryHandle) => Promise<void> };

          if (movible.move) await movible.move(destino);
          else {
            /* Sin «move» (navegador viejo): se copia y se quita el original. */
            const nuevo = await destino.getFileHandle(a.nombre, { create: true });
            const w = await nuevo.createWritable();

            await (await a.handle.getFile()).stream().pipeTo(w);
            await a.dir.removeEntry(a.nombre);
          }

          fuera.push(idClip(c, a.n));
          hechos++;
        } catch (error) {
          console.warn("[coding-abp] mover", a.nombre, error);
        }
      }
    } finally {
      setDoc((d) => ({ ...d, clips: { ...d.clips, ...Object.fromEntries(fuera.map((id) => [id, { ...d.clips[id], estado: "descartado" as const, fuera: true }])) } }));
      setMoviendo(false);
      setIndice(0);
      toast.success(`${hechos} clips movidos a «_descartados»`);
    }
  };

  /* ------------------------------ pantalla ------------------------------ */

  if (!abierta) {
    return (
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h3 className="text-lg font-bold text-white">Coding del ABP del rival</h3>
        <p className="text-sm text-white/65">
          Abre la carpeta de la jornada (por ejemplo <b>ABP\RIVAL\ABP - 10 CARTAGENA</b>). Los clips no se suben: se ven desde tu ordenador.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={elige} className="flex items-center gap-2 rounded-lg bg-[#D8B45A] px-4 py-2 text-sm font-bold text-[#0B0F14]">
            <FolderOpen size={16} /> Abrir carpeta de la jornada
          </button>
          {guardada && (
            <button type="button" onClick={() => void abre(guardada)} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5">
              Seguir con «{guardada.name}»
            </button>
          )}
        </div>
      </div>
    );
  }

  const est = actual ? estadoDe(idActual) : null;
  const def = CARPETAS.find((c) => c.key === carpeta)?.fase === "def";
  const pct = total ? Math.round((elegidos / total) * 1000) / 10 : 0;

  return (
    <div className="space-y-4">
      {/* Cabecera: carpeta, progreso y objetivo del 15 % */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{abierta.nombre}</p>
          <p className="text-xs text-white/55">
            {decididos}/{total} vistos · {elegidos} elegidos ({String(pct).replace(".", ",")} %) · orientativo ≈15 % (no obliga)
          </p>
        </div>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-[#D8B45A]" style={{ width: `${total ? (decididos / total) * 100 : 0}%` }} />
        </div>
        <div className="flex flex-wrap gap-1">
          {CARPETAS.map((c) => {
            const n = abierta.porCarpeta.get(c.key)?.length ?? 0;
            if (!n) return null;
            const e = (porCarpeta.get(c.key) ?? []).filter(([, x]) => x.estado === "elegido").length;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => (setCarpeta(c.key), setIndice(0))}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${carpeta === c.key ? "bg-[#D8B45A] text-[#0B0F14]" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
              >
                {c.corto} · {e}/{n}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => setRevision((r) => !r)} className="ml-auto rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5">
          {revision ? "Volver al visor" : `Revisar elegidos (${elegidos})`}
        </button>
      </div>

      {revision ? (
        <Revision
          abierta={abierta}
          doc={doc}
          comparar={comparar}
          setComparar={setComparar}
          urlDe={urlDe}
          cambia={cambia}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
          {/* Cola de la carpeta */}
          <ol className="max-h-[70vh] overflow-auto rounded-2xl border border-white/10 bg-white/[0.02] p-2 text-sm">
            {lista.map((a, i) => {
              const e = estadoDe(idClip(carpeta, a.n));
              return (
                <li key={a.n}>
                  <button
                    type="button"
                    onClick={() => setIndice(i)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left ${i === indice ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"}`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${e.estado === "elegido" ? "bg-emerald-400" : e.estado === "descartado" ? "bg-red-400/70" : "bg-white/25"}`} />
                    <span className="tabular-nums">{a.n}</span>
                    <span className="min-w-0 truncate text-xs text-white/45">{e.nota || etiquetasEnTexto(e.etiquetas)}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* El vídeo */}
          <div className="min-w-0 space-y-2">
            <div className="relative overflow-hidden rounded-2xl bg-black">
              {url && (
                <video
                  key={url}
                  ref={video}
                  src={url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                  onError={() => setFallo("Este clip no se puede ver en el navegador (códec). Ábrelo fuera o expórtalo en H.264.")}
                  className="aspect-video w-full"
                />
              )}
              {actual && est && (
                <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
                  <span className="rounded-md bg-black/70 px-2 py-1 text-sm font-bold text-white">
                    {carpeta} · {actual.n}
                  </span>
                  {est.estado !== "pendiente" && (
                    <span className={`rounded-md px-2 py-1 text-sm font-bold ${est.estado === "elegido" ? "bg-emerald-500 text-white" : "bg-red-500/80 text-white"}`}>
                      {est.estado === "elegido" ? "ELEGIDO" : "DESCARTADO"}
                    </span>
                  )}
                  <span className="rounded-md bg-black/70 px-2 py-1 text-sm text-white/80">{String(velocidad).replace(".", ",")}×</span>
                </div>
              )}
              {escribiendo && (
                <form
                  className="absolute inset-x-3 bottom-14"
                  onSubmit={(e) => {
                    e.preventDefault();
                    cambia(idActual, { nota: nota.trim() });
                    setEscribiendo(false);
                  }}
                >
                  <input
                    autoFocus
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && setEscribiendo(false)}
                    placeholder="Nota para el cuerpo técnico (Enter guarda, Esc cancela)"
                    className="w-full rounded-lg border border-[#D8B45A]/60 bg-black/85 px-3 py-2 text-sm text-white outline-none"
                  />
                </form>
              )}
            </div>
            {fallo && <p className="text-sm text-amber-300">{fallo}</p>}
            {est?.nota && <p className="text-sm text-white/85">Nota: {est.nota}</p>}
            {est?.marca !== undefined && <p className="text-xs text-white/50">Momento clave en {String(est.marca).replace(".", ",")} s (N para ir)</p>}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => decide("elegido")} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">
                K · Me lo quedo
              </button>
              <button type="button" onClick={() => decide("descartado")} className="rounded-lg bg-red-600/80 px-4 py-2 text-sm font-bold text-white">
                D · Descartar
              </button>
              <button type="button" onClick={() => decide("pendiente")} className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/75">
                S · Pendiente
              </button>
              <button type="button" onClick={deshaz} className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/75">
                Z · Deshacer
              </button>
            </div>

            {/* Los atajos siempre a la vista; «?» abre la lista entera. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/[0.03] px-3 py-1.5 text-xs text-white/55">
              <Keyboard size={13} />
              {ATAJOS.slice(0, 8).map(([t, d]) => (
                <span key={t}>
                  <b className="text-white/80">{t}</b> {d}
                </span>
              ))}
              <button type="button" onClick={() => setAyuda((x) => !x)} className="ml-auto text-white/70 underline">
                ? {ayuda ? "menos" : "todos"}
              </button>
            </div>
            {ayuda && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/55 sm:grid-cols-3">
                {ATAJOS.map(([t, d]) => (
                  <span key={t}>
                    <b className="text-white/80">{t}</b> {d}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Etiquetas de un toque */}
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            {/* Dorsales: «saca el 11, remata el 5» (experto de fútbol). */}
            <div className="grid grid-cols-2 gap-2">
              {(["saca", "remata"] as const).map((campo) => (
                <label key={`${idActual}-${campo}`} className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                  {campo === "saca" ? "Saca (dorsal)" : "Remata (dorsal)"}
                  <input
                    inputMode="numeric"
                    defaultValue={est?.[campo] ?? ""}
                    onBlur={(e) => e.target.value.trim() !== (est?.[campo] ?? "") && cambia(idActual, { [campo]: e.target.value.trim() })}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm font-normal normal-case text-white"
                  />
                </label>
              ))}
            </div>
            {GRUPOS.filter((g) => !g.soloDef || def).map((g) => (
              <div key={g.key}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-white/45">{g.titulo}</p>
                <div className="flex flex-wrap gap-1">
                  {g.opciones.map((o) => {
                    const puesta = est?.etiquetas?.[g.key] === o;
                    return (
                      <button
                        key={o}
                        type="button"
                        onClick={() => etiqueta(g.key, o)}
                        className={`rounded-full px-2.5 py-1 text-xs ${puesta ? "bg-[#D8B45A] font-semibold text-[#0B0F14]" : "bg-white/5 text-white/75 hover:bg-white/10"}`}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {trayectoria(est?.etiquetas) && <p className="text-xs text-white/60">Envío {trayectoria(est?.etiquetas)} (por lado y pie)</p>}
          </div>
        </div>
      )}

      {/* El resumen y el texto */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <h4 className="text-sm font-bold text-white">Lo que repite (de todos los clips etiquetados)</h4>
          {CARPETAS.map((c) => resumenDe(c.key, porCarpeta.get(c.key) ?? [])).filter(Boolean).length ? (
            <ul className="space-y-1 text-sm text-white/80">
              {CARPETAS.map((c) => resumenDe(c.key, porCarpeta.get(c.key) ?? []))
                .filter(Boolean)
                .map((r) => (
                  <li key={r}>{r}</li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-white/50">Etiqueta los clips y aquí sale lo que más se repite en cada tipo.</p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={!descartados.length || moviendo}
              onClick={() => void mueveDescartados()}
              className="flex items-center gap-1.5 rounded-lg border border-red-400/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-40"
            >
              <Trash2 size={14} /> {moviendo ? "Moviendo…" : `Mover ${descartados.length} descartados a «_descartados»`}
            </button>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-white">Texto para el cuerpo técnico</h4>
            <label className="ml-auto flex items-center gap-1 text-xs text-white/60">
              <input type="checkbox" checked={conResumen} onChange={(e) => setConResumen(e.target.checked)} /> con lo que repite
            </label>
          </div>
          <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 font-mono text-[12px] text-white/85">{elegidos ? texto : "Aún no hay elegidos."}</pre>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!elegidos}
              onClick={() => void navigator.clipboard.writeText(texto).then(() => toast.success("Texto copiado"))}
              className="flex items-center gap-1.5 rounded-lg bg-[#D8B45A] px-3 py-1.5 text-sm font-bold text-[#0B0F14] disabled:opacity-40"
            >
              <ClipboardCopy size={14} /> Copiar
            </button>
            <button
              type="button"
              disabled={!elegidos || !equipo || !jornada}
              onClick={llevaApuntes}
              title={equipo && jornada ? `A «Apuntes y vídeo» de ${equipo}, J${jornada}` : "Elige el rival arriba"}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:bg-white/5 disabled:opacity-40"
            >
              <NotebookPen size={14} /> Pasar a «Apuntes y vídeo»
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  REVISAR ELEGIDOS Y COMPARAR DOS                                     */
/* ------------------------------------------------------------------ */

function Revision({
  abierta,
  doc,
  comparar,
  setComparar,
  urlDe,
  cambia,
}: {
  abierta: Abierta;
  doc: CodingDoc;
  comparar: string[];
  setComparar: (v: string[]) => void;
  urlDe: (a: Archivo) => Promise<string>;
  cambia: (id: string, c: Partial<ClipEstado>) => void;
}) {
  const elegidos = CARPETAS.flatMap((c) =>
    (abierta.porCarpeta.get(c.key) ?? []).filter((a) => doc.clips[idClip(c.key, a.n)]?.estado === "elegido").map((a) => ({ c: c.key, a, id: idClip(c.key, a.n) })),
  );

  const [urls, setUrls] = useState<Record<string, string>>({});
  const refs = useRef<Record<string, HTMLVideoElement | null>>({});

  /* Sonido: ninguno por defecto; Tab lo pasa de un clip al otro (experto de vídeo). */
  const [sonido, setSonido] = useState<number | null>(null);

  useEffect(() => {
    if (comparar.length !== 2) return;

    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      e.preventDefault();
      setSonido((x) => (x === null ? 0 : x === 0 ? 1 : null));
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [comparar.length]);

  useEffect(() => {
    let vivo = true;

    for (const id of comparar) {
      const e = elegidos.find((x) => x.id === id);

      if (e && !urls[id]) void urlDe(e.a).then((u) => vivo && setUrls((p) => ({ ...p, [id]: u })));
    }

    return () => {
      vivo = false;
    };
  });

  /* Los dos a la vez, cada uno desde su momento clave. */
  const aLaVez = () => {
    for (const id of comparar) {
      const v = refs.current[id];

      if (!v) continue;

      v.currentTime = Math.max(0, (doc.clips[id]?.marca ?? 2) - 2);
      void v.play();
    }
  };

  return (
    <div className="space-y-4">
      {comparar.length === 2 && (
        <div className="space-y-2">
          <div className="grid gap-2 md:grid-cols-2">
            {comparar.map((id, i) => (
              <div key={id} className="overflow-hidden rounded-xl bg-black">
                {urls[id] && <video ref={(v) => void (refs.current[id] = v)} src={urls[id]} muted={sonido !== i} playsInline controls className="aspect-video w-full" />}
                <p className="px-2 py-1 text-xs text-white/70">
                  {id.replace("/", " · ")}
                  {sonido === i ? " · con sonido" : ""}
                </p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={aLaVez} className="rounded-lg bg-[#D8B45A] px-3 py-1.5 text-sm font-bold text-[#0B0F14]">
              Reproducir los dos desde su momento clave
            </button>
            <button type="button" onClick={() => setComparar([])} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/75">
              Cerrar comparación
            </button>
            <span className="self-center text-xs text-white/50">Tab: sonido de uno, del otro o ninguno</span>
          </div>
        </div>
      )}

      {elegidos.length === 0 ? (
        <p className="text-sm text-white/55">Aún no hay elegidos.</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {elegidos.map(({ id, a }) => {
            const e = doc.clips[id];
            const marcado = comparar.includes(id);
            return (
              <li key={id} className={`space-y-1.5 rounded-xl border p-3 ${marcado ? "border-[#D8B45A]/70" : "border-white/10"} bg-white/[0.02]`}>
                <div className="flex items-center gap-2">
                  <b className="text-sm text-white">{id.replace("/", " · ")}</b>
                  <button
                    type="button"
                    onClick={() => setComparar(marcado ? comparar.filter((x) => x !== id) : [...comparar, id].slice(-2))}
                    className="ml-auto rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/75 hover:bg-white/10"
                  >
                    {marcado ? "Quitar" : "Comparar"}
                  </button>
                  <button type="button" onClick={() => cambia(id, { estado: "pendiente" })} className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/75 hover:bg-white/10">
                    A pendiente
                  </button>
                </div>
                <input
                  defaultValue={e?.nota ?? ""}
                  onBlur={(ev) => ev.target.value !== (e?.nota ?? "") && cambia(id, { nota: ev.target.value.trim() })}
                  placeholder="Nota"
                  className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-white"
                />
                <p className="text-xs text-white/45">{etiquetasEnTexto(e?.etiquetas) || a.nombre}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
