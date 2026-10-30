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
import { ClipboardCopy, FolderOpen, Keyboard, Maximize2, MessageCircle, Minimize2, NotebookPen, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { PizarraVideo } from "@/components/coding/PizarraVideo";
import { escenaEn, escenaVacia, type EscenaTel } from "@/lib/coding/telestracion";
import { avisaHecho } from "@/lib/aviso-hecho";
import { CampogramaCaidas } from "@/components/abp/coding/CampogramaCaidas";
import { conCaidas, slidesDeCaidas, tableroDeJornada } from "@/lib/abp/coding-pizarra";
import { EMPTY_PIZARRA_STORE, type PizarraStore } from "@/lib/abp/pizarra";
import { clipsKey, normalizaClips, type ClipsJornada } from "@/lib/rivals/analisis";
import { APUNTES_KIND, APUNTES_RIVAL_VACIO, apuntesRivalKey, normalizaCuaderno, nuevoId, type ApuntesRivalDoc } from "@/lib/abp/apuntes";
import {
  CARPETAS,
  CODING_VACIO,
  gruposDe,
  aApuntes,
  codingKey,
  etiquetasEnTexto,
  idClip,
  numeroDeArchivo,
  resumenDe,
  rutinasDe,
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

const VIDEO = /\.(mov|mp4|m4v)$/i;

/**
 * De qué carpeta del coding es un clip, mirando su ruta de dentro afuera:
 * «CORNER OF», «Córner ofensivo», «FALTAS LAT DEF», «SDB DEF», «Saque de
 * banda»… y el propio nombre del fichero («CORNER OF-17.mov»). Sin lado
 * escrito, ofensivo.
 */
function carpetaDe(segmentos: string[]): CarpetaKey | null {
  for (const crudo of [...segmentos].reverse()) {
    const s = crudo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase();
    const def = /\bDEF/.test(s);
    const tipo = /CORNER/.test(s) ? "CORNER" : /FALTA/.test(s) ? "FALTA" : /\bSDB\b|SAQUE DE BANDA|\bBANDA\b/.test(s) ? "SDB" : null;

    if (tipo) return `${tipo} ${def ? "DEF" : "OF"}` as CarpetaKey;
  }

  return null;
}

/*
| Lee la jornada (30/10/2026: con todas sus subcarpetas, a cualquier
| profundidad). Antes sólo valía «ABP - 10 CARTAGENA» o su «ABP» con las seis
| carpetas justo debajo; ahora se recogen los vídeos de todo lo que cuelgue de
| la carpeta elegida y cada uno va a su sitio por su ruta. «_descartados» no
| se lee. Un número repetido en la misma carpeta (dos subcarpetas con su
| «CORNER OF-3») toma el siguiente libre, en orden de ruta para que sea
| siempre el mismo.
*/
async function leeCarpeta(raiz: FileSystemDirectoryHandle): Promise<Abierta & { sinSitio: number }> {
  const encontrados: { carpeta: CarpetaKey; ruta: string; nombre: string; n: number | null; handle: FileSystemFileHandle; dir: FileSystemDirectoryHandle }[] = [];
  let sinSitio = 0;

  const recorre = async (dir: FileSystemDirectoryHandle, camino: string[]) => {
    for (const [nombre, h] of await hijos(dir)) {
      if (nombre.startsWith(".") || nombre.startsWith("._")) continue;

      if (h.kind === "directory") {
        if (nombre.toLowerCase() === "_descartados") continue;
        await recorre(h as FileSystemDirectoryHandle, [...camino, nombre]);
        continue;
      }

      if (!VIDEO.test(nombre)) continue;

      const carpeta = carpetaDe([...camino, nombre.replace(/-\d+\.\w+$/, "")]);

      if (!carpeta) {
        sinSitio++;
        continue;
      }

      encontrados.push({ carpeta, ruta: [...camino, nombre].join("/"), nombre, n: numeroDeArchivo(nombre), handle: h as FileSystemFileHandle, dir });
    }
  };

  await recorre(raiz, []);

  const porCarpeta = new Map<CarpetaKey, Archivo[]>();

  for (const c of CARPETAS) {
    const suyos = encontrados.filter((e) => e.carpeta === c.key).sort((a, b) => (a.n ?? 1e9) - (b.n ?? 1e9) || a.ruta.localeCompare(b.ruta));
    const usados = new Set<number>();
    const archivos: Archivo[] = [];

    for (const e of suyos) {
      let n = e.n ?? 1;
      while (usados.has(n)) n++;
      usados.add(n);
      archivos.push({ n, handle: e.handle, dir: e.dir, nombre: e.nombre });
    }

    if (archivos.length) porCarpeta.set(c.key, archivos.sort((a, b) => a.n - b.n));
  }

  /* El nombre de la jornada: si se eligió su «ABP», el de la carpeta de arriba no se conoce; vale el suyo. */
  return { raiz, nombre: raiz.name, porCarpeta, sinSitio };
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
  ["E", "Siguiente elegido"],
  ["F", "Pantalla completa (con las etiquetas)"],
  ["R", "Revisar elegidos"],
  ["Tab (mantener)", "3× mientras lo pulsas"],
  ["?", "Todos los atajos"],
];

export function CodingAbpRival({
  equipo,
  jornadaPartido = null,
  onRecoger,
  onApuntes,
}: {
  equipo: string | null;
  /** «J10»: la jornada del partido contra este rival, para leer el estado sin abrir la carpeta. */
  jornadaPartido?: string | null;
  onRecoger?: () => void;
  onApuntes?: () => void;
}) {
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
  const [masDetalle, setMasDetalle] = useState(false);
  const [moviendo, setMoviendo] = useState(false);
  const [fallo, setFallo] = useState("");
  const video = useRef<HTMLVideoElement>(null);

  /* El <video> también como estado: la pizarra se coloca midiendo el elemento. */
  const [elementoVideo, setElementoVideo] = useState<HTMLVideoElement | null>(null);
  const montaVideo = useCallback((v: HTMLVideoElement | null) => {
    video.current = v;
    setElementoVideo(v);
  }, []);

  /* La pizarra que se está pintando, atada a su clip: al cambiar de clip se cierra sola. */
  const [pintando, setPintando] = useState<{ clip: string; id: string } | null>(null);
  const deshacer = useRef<{ id: string; antes: ClipEstado | undefined; carpeta: CarpetaKey; indice: number }[]>([]);
  const precarga = useRef(new Map<string, string>());

  /*
  | Sin carpeta abierta se lee la de la última vez, si es de esta jornada; si
  | no (otro ordenador, otra jornada), la que tocaría por nombre: «ABP - 10
  | CARTAGENA». Así el estado se ve al entrar, sin abrir nada (30/10/2026).
  */
  const nJornada = Number((jornadaPartido ?? "").replace(/\D/g, "")) || null;
  const esperada = equipo && nJornada ? codingKey(`ABP - ${nJornada} ${equipo}`) : null;
  const guardadaVale = guardada && (!nJornada || deLaCarpeta(guardada.name).jornada === nJornada);
  const clave = abierta ? codingKey(abierta.nombre) : guardadaVale && guardada ? codingKey(guardada.name) : esperada ?? "abp-coding-rival:_";

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
        toast.error("En esa carpeta ni en sus subcarpetas hay clips de córner, falta o saque de banda", {
          description: "La ruta o el nombre de cada vídeo tiene que decir CORNER, FALTA o SDB (y DEF si es defensivo).",
        });
        return;
      }

      const total = [...a.porCarpeta.values()].reduce((n, l) => n + l.length, 0);
      toast.success(`${total} clips recogidos de todas las subcarpetas`, {
        description: a.sinSitio ? `${a.sinSitio} vídeos no dicen si son córner, falta o saque de banda y se quedan fuera.` : undefined,
      });

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

  /*
  | LA PIZARRA SOBRE EL CLIP (30/10/2026)
  |
  | Las mismas herramientas de pintado que el coding de partido, por si hace
  | falta señalar algo en un córner o una falta. Se guarda en este mismo
  | documento, una lista por clip.
  */
  const escenasClip = useMemo(() => (doc.escenas ?? []).filter((e) => e.video === idActual), [doc.escenas, idActual]);
  const editandoPizarra = pintando?.clip === idActual ? pintando.id : null;

  const guardaEscena = useCallback(
    (escena: EscenaTel) =>
      setDoc((d) => ({
        ...d,
        escenas: [...(d.escenas ?? []).filter((e) => e.id !== escena.id), escena],
        actualizado: new Date().toISOString(),
      })),
    [setDoc],
  );

  const borraEscena = useCallback(
    (id: string) => {
      setDoc((d) => ({ ...d, escenas: (d.escenas ?? []).filter((e) => e.id !== id), actualizado: new Date().toISOString() }));
      setPintando(null);
    },
    [setDoc],
  );

  const abrePizarra = useCallback(() => {
    const v = video.current;
    if (!v || !idActual) return;

    v.pause();

    const ahora = v.currentTime * 1000;
    const existente = escenaEn(escenasClip, ahora);

    if (existente) {
      setPintando({ clip: idActual, id: existente.id });
      return;
    }

    const nueva: EscenaTel = {
      ...escenaVacia(ahora, `esc-${Math.round(ahora)}-${Math.random().toString(36).slice(2, 6)}`, new Date().toISOString()),
      video: idActual,
    };

    guardaEscena(nueva);
    setPintando({ clip: idActual, id: nueva.id });
  }, [escenasClip, guardaEscena, idActual]);

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

  /*
  | Siguiente elegido (29/10/2026, lo pidió el analista): salta al próximo
  | clip «Me lo quedo» de esta carpeta y, si no hay más, de las siguientes.
  */
  const siguienteElegido = () => {
    if (!abierta) return;

    const orden = CARPETAS.filter((c) => abierta.porCarpeta.get(c.key)?.length);
    const desdeCarpeta = Math.max(0, orden.findIndex((c) => c.key === carpeta));

    for (let paso = 0; paso <= orden.length; paso++) {
      const c = orden[(desdeCarpeta + paso) % orden.length];
      const suya = (abierta.porCarpeta.get(c.key) ?? []).filter((a) => !doc.clips[idClip(c.key, a.n)]?.fuera);
      const desde = paso === 0 ? indice + 1 : 0;
      const i = suya.findIndex((a, j) => j >= desde && doc.clips[idClip(c.key, a.n)]?.estado === "elegido");

      if (i >= 0) {
        setCarpeta(c.key);
        setIndice(i);
        return;
      }
    }

    toast.info("No hay más clips elegidos");
  };

  /*
  | Pantalla completa CON la columna de etiquetas (29/10/2026): la del
  | <video> deja fuera las etiquetas y los botones; se pone en pantalla
  | completa el visor entero y la cola se esconde para dar sitio al vídeo.
  */
  const visor = useRef<HTMLDivElement>(null);
  const [completa, setCompleta] = useState(false);

  useEffect(() => {
    const cambio = () => setCompleta(Boolean(visor.current) && document.fullscreenElement === visor.current);

    document.addEventListener("fullscreenchange", cambio);

    return () => document.removeEventListener("fullscreenchange", cambio);
  }, []);

  const alternaCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void visor.current?.requestFullscreen?.().catch(() => toast.error("Este navegador no deja poner la pantalla completa"));
  };

  /* ------------------------------ teclado ------------------------------ */

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      /* Mientras se pinta, las teclas son de la pizarra (F foco, D distancia…), no de la criba. */
      if (!abierta || escribiendo || editandoPizarra || e.ctrlKey || e.metaKey || e.altKey) return;

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
        e: siguienteElegido,
        f: alternaCompleta,
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

  const automatico = textoCoding(rival || equipo || "", porCarpeta, conResumen);

  /* Lo escrito a mano manda; el automático queda para volver a él. */
  const aMano = typeof doc.texto === "string";
  const texto = aMano ? doc.texto! : automatico;
  const cambiadoDetras = aMano && doc.textoBase !== undefined && doc.textoBase !== automatico;

  /*
  | EL CAMPOGRAMA, SOLO EN LA PIZARRA DE LA JORNADA (28/10/2026). Una
  | diapositiva «DÓNDE CAEN» por carpeta en el tablero riv-RIV-NN; se rehace
  | (con un respiro) cada vez que cambian las caídas. Sin tablero de esa
  | jornada no se crea nada: se avisa.
  */
  const { value: pizarra, setValue: setPizarra, status: estadoPizarra } = useRemoteDoc<PizarraStore>({
    key: "abp-pizarra",
    kind: "abp",
    fallback: EMPTY_PIZARRA_STORE,
  });

  const claveTablero = jornada ? tableroDeJornada(jornada) : "";

  const hayTablero = Boolean(claveTablero && pizarra.tableros?.[claveTablero]);

  const nombreRival = rival || equipo || "rival";

  const nuevasCaidas = useMemo(() => slidesDeCaidas(porCarpeta, nombreRival), [porCarpeta, nombreRival]);

  useEffect(() => {
    if (!abierta || !hayTablero || estadoPizarra === "loading") return;

    const id = setTimeout(() => {
      setPizarra((store) => conCaidas(store, claveTablero, nuevasCaidas) ?? store);
    }, 1500);

    return () => clearTimeout(id);
  }, [abierta, hayTablero, estadoPizarra, claveTablero, nuevasCaidas, setPizarra]);

  /* --------------------------- apuntes y borrado --------------------------- */

  const { value: apuntes, setValue: setApuntes } = useRemoteDoc<ApuntesRivalDoc>({
    key: apuntesRivalKey(equipo ?? "_"),
    kind: APUNTES_KIND,
    fallback: APUNTES_RIVAL_VACIO,
  });

  /*
  | LO RECOGIDO POR EL VIGÍA (30/10/2026). Sólo lectura: la misma hoja de
  | clips que «Recoger y láminas», para decir si el paso 1 está hecho y cuándo.
  */
  const [recogida, setRecogida] = useState<{ equipo: string; jornadas: Record<string, ClipsJornada> } | null>(null);

  useEffect(() => {
    if (!equipo) return;

    let cancelado = false;

    fetch(`/api/docs?key=${encodeURIComponent(clipsKey(equipo))}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json: { data?: unknown } | null) => {
        if (!cancelado) setRecogida({ equipo, jornadas: normalizaClips(json?.data).jornadas });
      })
      .catch(() => {
        /* Sin red: el paso 1 se queda sin estado. */
      });

    return () => {
      cancelado = true;
    };
  }, [equipo]);

  const recogidaJornada = useMemo(() => {
    if (!recogida || recogida.equipo !== equipo || !nJornada) return null;

    const entrada = Object.entries(recogida.jornadas).find(([k]) => Number(k.replace(/\D/g, "")) === nJornada);

    if (!entrada) return null;

    const j = entrada[1];

    return j.clips.length || j.docs.length ? j : null;
  }, [recogida, equipo, nJornada]);

  const llevaApuntes = () => {
    if (!equipo || !jornada) return;

    const clave = `J${jornada}`;

    const cuaderno = normalizaCuaderno(apuntes?.jornadas?.[clave]);

    /* Los de clip se rehacen con lo de ahora; los de minuto (escritos a mano) se quedan. */
    const nuevos = aApuntes(porCarpeta, nuevoId);

    setApuntes((d) => ({ ...d, jornadas: { ...d.jornadas, [clave]: { ...cuaderno, apuntes: [...cuaderno.apuntes.filter((a) => a.ref?.clase !== "clip"), ...nuevos], actualizado: new Date().toISOString() } } }));

    toast.success(`${nuevos.length} apuntes en «Apuntes y vídeo» (J${jornada})`);
  };

  /*
  | COPIAR LOS ELEGIDOS (29/10/2026, lo pidió el analista): a
  | «ABP\RIVAL\CLIPS SELECCIONADOS\J10 - CARTAGENA», una subcarpeta por tipo.
  | El navegador no deja escribir fuera de la carpeta abierta sin permiso, así
  | que «CLIPS SELECCIONADOS» se elige una vez y se recuerda. Lo que ya está
  | copiado (mismo nombre y tamaño) no se vuelve a copiar.
  */
  const [copiando, setCopiando] = useState(false);

  const copiaElegidos = async () => {
    if (!abierta) return;

    const lista = CARPETAS.flatMap((c) => (abierta.porCarpeta.get(c.key) ?? []).filter((a) => doc.clips[idClip(c.key, a.n)]?.estado === "elegido").map((a) => ({ c: c.key, a })));

    if (!lista.length) return;

    let destino = await idb<ConPermiso>("readonly", (st) => st.get("seleccionados"));

    try {
      if (destino?.queryPermission && (await destino.queryPermission({ mode: "readwrite" })) !== "granted") {
        if ((await destino.requestPermission?.({ mode: "readwrite" })) !== "granted") destino = undefined;
      }

      if (!destino) {
        const picker = (window as unknown as { showDirectoryPicker?: (o: object) => Promise<ConPermiso> }).showDirectoryPicker;

        if (!picker) return;

        toast.info("Elige la carpeta «CLIPS SELECCIONADOS» (dentro de ABP\\RIVAL). Se recuerda para las próximas jornadas.");
        destino = await picker({ id: "abp-seleccionados", mode: "readwrite", startIn: abierta.raiz });
        void idb("readwrite", (st) => st.put(destino, "seleccionados"));
      }
    } catch {
      return;
    }

    setCopiando(true);

    const nombre = (jornada ? `J${jornada} - ${rival}` : rival || abierta.nombre).toUpperCase().replace(/[\\/:*?"<>|]/g, "");
    let copiados = 0;
    let fallos = 0;

    try {
      const jornadaDir = await destino!.getDirectoryHandle(nombre, { create: true });

      for (const { c, a } of lista) {
        try {
          const dir = await jornadaDir.getDirectoryHandle(c, { create: true });
          const origen = await a.handle.getFile();
          const ya = await dir.getFileHandle(a.nombre).then((h) => h.getFile()).catch(() => null);

          if (ya && ya.size === origen.size) {
            copiados++;
            continue;
          }

          const w = await (await dir.getFileHandle(a.nombre, { create: true })).createWritable();

          await origen.stream().pipeTo(w);
          copiados++;
        } catch (error) {
          fallos++;
          console.warn("[coding-abp] copiar", a.nombre, error);
        }
      }
    } finally {
      setCopiando(false);
      avisaHecho({
        titulo: fallos ? `Copiados ${copiados} de ${lista.length} clips` : `${copiados} clips copiados`,
        texto: `En «${destino!.name}\\${nombre}»${fallos ? `; ${fallos} no se han podido copiar` : ""}.`,
        ok: !fallos,
      });
    }
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
    /*
    | EL ESTADO REAL DE LA JORNADA (30/10/2026, expertos). Antes los tres
    | pasos eran texto fijo, iguales hiciera lo que hiciera el analista. Ahora
    | cada uno dice si está hecho, con su cifra y su fecha: recogida (lo que
    | dejó el vigía), criba (lo decidido en la carpeta de esta jornada) y
    | apuntes (lo que ya está en «Apuntes y vídeo»).
    */
    const hechos = Object.entries(doc.clips ?? {});
    const elegidosYa = hechos.filter(([, c]) => c.estado === "elegido").length;
    const descartadosYa = hechos.filter(([, c]) => c.estado === "descartado").length;
    const vistos = elegidosYa + descartadosYa;
    const cuando = (iso?: string) => {
      const d = iso ? new Date(iso) : null;

      return d && !Number.isNaN(d.getTime())
        ? d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "")
        : "";
    };
    /* Lo decidido por tipo: córner, falta y banda, cuando atacan y cuando defienden. */
    const porTipo = CARPETAS.map((c) => {
      const suyos = hechos.filter(([id]) => id.startsWith(`${c.key}/`)).map(([, x]) => x);

      return { ...c, elegidos: suyos.filter((x) => x.estado === "elegido").length, vistos: suyos.filter((x) => x.estado !== "pendiente").length };
    }).filter((c) => c.vistos);
    /* Los apuntes ya guardados de este rival, de la última jornada hacia atrás (29/10/2026). */
    const hechosRival = Object.entries(apuntes.jornadas ?? {})
      .map(([clave, cuaderno]) => ({ clave, n: Number(clave.replace(/\D/g, "")) || 0, apuntes: normalizaCuaderno(cuaderno).apuntes.filter((a) => a.texto.trim()) }))
      .filter((j) => j.apuntes.length)
      .sort((a, b) => b.n - a.n)
      .slice(0, 2);
    const apuntesJornada = nJornada ? hechosRival.find((j) => j.n === nJornada) : undefined;

    const hecho1 = Boolean(recogidaJornada);
    const hecho2 = vistos > 0;
    const hecho3 = Boolean(apuntesJornada?.apuntes.some((a) => a.ref?.clase === "clip"));

    const pasos: { n: number; titulo: string; texto: string; estado: string; hecho: boolean; accion?: { texto: string; onClick: () => void }; principal?: boolean }[] = [
      {
        n: 1,
        hecho: hecho1,
        titulo: "Recoger la carpeta",
        texto: "El vigía deja en el ordenador del club los PDF de ABP y de centros y los vídeos de la jornada.",
        estado: recogidaJornada
          ? [
              recogidaJornada.clips.length ? `${recogidaJornada.clips.length} vídeos` : "",
              recogidaJornada.docs.length ? `${recogidaJornada.docs.length} PDF` : "",
              recogidaJornada.importadoEn ? `recogida el ${cuando(recogidaJornada.importadoEn)}` : "",
            ]
              .filter(Boolean)
              .join(" · ")
          : nJornada
            ? `Pendiente para la J${nJornada}`
            : "Pendiente",
        ...(onRecoger ? { accion: { texto: hecho1 ? "Ver lo recogido" : "Recoger la carpeta", onClick: onRecoger } } : {}),
      },
      {
        n: 2,
        hecho: hecho2,
        titulo: "Cribar los clips",
        texto: "Abre la carpeta y quédate con los buenos.",
        estado: hecho2
          ? [`${vistos} cribados`, `${elegidosYa} elegidos (K)`, `${descartadosYa} descartados (D)`, doc.actualizado ? `última criba el ${cuando(doc.actualizado)}` : ""].filter(Boolean).join(" · ")
          : "Pendiente",
        accion: { texto: "Abrir carpeta de la jornada", onClick: () => void elige() },
        principal: true,
      },
      {
        n: 3,
        hecho: hecho3,
        titulo: "Llevarlo al informe",
        texto: "El texto sale con tu formato, «Dónde caen» entra solo en la pizarra y lo elegido pasa a Apuntes y vídeo.",
        estado: hecho3 && apuntesJornada ? `${apuntesJornada.apuntes.length} apuntes en la J${apuntesJornada.n}` : "Pendiente",
        ...(onApuntes ? { accion: { texto: "Ver apuntes", onClick: onApuntes } } : {}),
      },
    ];
    /* El paso en curso: el primero sin hacer de la criba en adelante (recoger puede ir por otro lado). */
    const activo = !hecho2 ? 2 : !hecho3 ? 3 : 0;

    return (
      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 pb-14 sm:p-6 md:pb-6">
        <div className="pr-12 md:pr-0">
          <h3 className="text-lg font-bold text-white">
            Carpeta de la jornada{nJornada ? ` · J${nJornada}` : ""}
          </h3>
          <p className="mt-1 hidden text-sm text-white/65 md:block">
            Abre en tu ordenador la carpeta de {equipo ?? "el rival"} de esta jornada. Los clips no se suben: se ven desde tu ordenador.
          </p>
        </div>

        {/* Un paso por fila con su estado: el que toca resalta y los otros
            bajan de peso. Una sola acción principal (abrir la carpeta); las
            demás son enlaces (30/10/2026, expertos). */}
        <ol className="divide-y divide-white/10 rounded-xl border border-white/10 bg-black/20">
          {pasos.map((p) => {
            const enCurso = p.n === activo;

            return (
              <li
                key={p.n}
                aria-current={enCurso ? "step" : undefined}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 ${enCurso ? "bg-[#D8B45A]/[0.07]" : ""}`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold ${
                    p.hecho ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-300" : enCurso ? "border-[#D8B45A] text-[#D8B45A]" : "border-white/25 text-white/50"
                  }`}
                  aria-label={p.hecho ? `Paso ${p.n}, hecho` : `Paso ${p.n}, pendiente`}
                >
                  {p.hecho ? "✓" : p.n}
                </span>
                <span className="min-w-0 flex-1 basis-48">
                  <span className={`text-sm font-semibold ${enCurso || p.hecho ? "text-white" : "text-white/70"}`}>{p.titulo}</span>
                  <span className={`block text-[12px] font-semibold ${p.hecho ? "text-emerald-300" : enCurso ? "text-[#D8B45A]" : "text-white/50"}`}>{p.estado}</span>
                  <span className="block text-[12px] leading-snug text-white/55">{p.texto}</span>
                  {p.principal && (
                    /* Los atajos, a la vista junto a la acción (30/10/2026). */
                    <span className="mt-1 hidden flex-wrap items-center gap-1.5 text-[11px] text-white/55 md:flex">
                      {[
                        ["K", "se queda"],
                        ["D", "descarta"],
                        ["S", "pendiente"],
                        ["Z", "deshace"],
                        ["1-8", "etiquetas"],
                        ["?", "todos"],
                      ].map(([k, t]) => (
                        <span key={k} className="inline-flex items-center gap-1">
                          <kbd className="rounded border border-white/20 bg-white/[0.06] px-1.5 py-px font-mono text-[11px] text-white/80">{k}</kbd>
                          {t}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                {p.accion &&
                  (p.principal ? (
                    <span className="flex flex-col gap-1 max-md:w-full md:items-end">
                      <button type="button" onClick={p.accion.onClick} className="flex items-center justify-center gap-2 rounded-lg bg-[#D8B45A] px-3 py-1.5 text-[13px] font-bold text-[#0B0F14] max-md:w-full max-md:py-2.5">
                        <FolderOpen size={14} /> {p.accion.texto}
                      </button>
                      {guardada && (
                        <button type="button" onClick={() => void abre(guardada)} className="text-[12px] text-white/60 hover:text-white">
                          o seguir con «{guardada.name}»
                        </button>
                      )}
                    </span>
                  ) : (
                    <button type="button" onClick={p.accion.onClick} className="whitespace-nowrap text-[13px] font-medium text-white/60 underline-offset-2 hover:text-white hover:underline max-md:py-1">
                      {p.accion.texto} →
                    </button>
                  ))}
              </li>
            );
          })}
        </ol>

        {porTipo.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Lo cribado por tipo · elegidos de los vistos</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {porTipo.map((c) => (
                <div key={c.key} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[12px] text-white/60">
                    {c.titulo === "SBO" || c.titulo === "SBD" ? "Saque de banda" : c.titulo === "FALTAS LAT" ? "Falta lateral" : c.titulo.charAt(0) + c.titulo.slice(1).toLowerCase()} · {c.fase === "of" ? "cuando atacan" : "cuando defienden"}
                  </p>
                  <p className="text-sm font-bold tabular-nums text-white">
                    {c.elegidos} <span className="text-[12px] font-normal text-white/55">de {c.vistos}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Una sola vez y en una línea (29/10/2026), no repetido en cada paso. */}
        <p className="text-[12px] text-white/55 md:hidden">Abrir la carpeta y cribar los clips se hace en el ordenador, con Chrome o Edge.</p>

        {hechosRival.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Ya apuntado de {equipo}</p>
            {hechosRival.map((j) => (
              <div key={j.clave} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="mb-1.5 text-xs font-semibold text-[#D8B45A]">Jornada {j.n || j.clave}</p>
                <ul className="space-y-1 text-[13px] leading-snug text-white/75">
                  {j.apuntes.slice(0, 6).map((a) => (
                    <li key={a.id}>
                      <span className="text-white/45">{a.fase === "of" ? "Cuando atacan" : "Cuando defienden"} · </span>
                      {a.texto}
                    </li>
                  ))}
                </ul>
                {j.apuntes.length > 6 && onApuntes && (
                  <button type="button" onClick={onApuntes} className="mt-1.5 text-[12px] font-semibold text-[#D8B45A] hover:underline">
                    Ver los {j.apuntes.length} →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    );
  }

  const est = actual ? estadoDe(idActual) : null;
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
        <div
          ref={visor}
          className={completa ? "grid h-screen grid-cols-[minmax(0,1fr)_340px] gap-4 overflow-hidden bg-[#0B0F14] p-4" : "grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_320px]"}
        >
          {/* Cola de la carpeta */}
          <ol className={`${completa ? "hidden" : ""} max-h-[70vh] overflow-auto rounded-2xl border border-white/10 bg-white/[0.02] p-2 text-sm`}>
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
          <div className={`min-w-0 space-y-2 ${completa ? "overflow-auto" : ""}`}>
            <div className="relative overflow-hidden rounded-2xl bg-black">
              {url && (
                <video
                  key={url}
                  ref={montaVideo}
                  src={url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls={!editandoPizarra}
                  onError={() => setFallo("Este clip no se puede ver en el navegador (códec). Ábrelo fuera o expórtalo en H.264.")}
                  className={completa ? "h-[calc(100vh-200px)] w-full object-contain" : "aspect-video w-full"}
                />
              )}
              {url && idActual && (
                <PizarraVideo
                  video={elementoVideo}
                  escenas={escenasClip}
                  editando={editandoPizarra}
                  alEditar={(id) => setPintando(id ? { clip: idActual, id } : null)}
                  alCambiar={guardaEscena}
                  alBorrar={borraEscena}
                  alPintar={abrePizarra}
                  visible
                />
              )}
              {actual && est && !editandoPizarra && (
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

            {/* Moverse sin teclado: clip a clip, de elegido en elegido y pantalla completa. */}
            <div className="flex flex-wrap gap-2 text-sm">
              <button type="button" onClick={() => setIndice((i) => Math.max(0, i - 1))} disabled={indice <= 0} className="rounded-lg border border-white/15 px-3 py-1.5 text-white/80 disabled:opacity-40">
                J · ← Anterior
              </button>
              <button type="button" onClick={() => setIndice((i) => Math.min(lista.length - 1, i + 1))} disabled={indice >= lista.length - 1} className="rounded-lg border border-white/15 px-3 py-1.5 text-white/80 disabled:opacity-40">
                L · Siguiente →
              </button>
              <button type="button" onClick={siguienteElegido} className="rounded-lg border border-emerald-500/50 px-3 py-1.5 text-emerald-300 hover:bg-emerald-500/10">
                E · Siguiente elegido →
              </button>
              <button type="button" onClick={alternaCompleta} className="ml-auto flex items-center gap-1.5 rounded-lg border border-[#D8B45A]/50 px-3 py-1.5 text-[#D8B45A] hover:bg-[#D8B45A]/10">
                {completa ? <Minimize2 size={14} /> : <Maximize2 size={14} />} F · {completa ? "Salir de pantalla completa" : "Pantalla completa"}
              </button>
            </div>

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
          <div className={`${completa ? "overflow-auto" : ""} space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3`}>
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
            {gruposDe(carpeta).filter((g) => !g.detalle || masDetalle || est?.etiquetas?.[g.key]).map((g) => (
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
            {gruposDe(carpeta).some((g) => g.detalle) && (
              <button type="button" onClick={() => setMasDetalle((v) => !v)} className="text-xs font-semibold text-[#D8B45A] hover:underline">
                {masDetalle ? "Menos detalle ▴" : `Más detalle (${gruposDe(carpeta).filter((g) => g.detalle).length} grupos: golpeo, bloqueos, llegada, vigilancias…) ▾`}
              </button>
            )}
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
          {/* Rutinas que repite: la misma acción en 2+ clips (segunda fase, 28/10/2026). */}
          {CARPETAS.some((c) => rutinasDe(porCarpeta.get(c.key) ?? []).length) && (
            <div className="space-y-1 pt-2">
              <h4 className="text-sm font-bold text-white">Rutinas que repite</h4>
              <ul className="space-y-1 text-sm text-white/80">
                {CARPETAS.flatMap((c) =>
                  rutinasDe(porCarpeta.get(c.key) ?? []).map((r) => (
                    <li key={`${c.key}${r.clave}`}>
                      <b className="text-[#D8B45A]">{c.corto}</b> · {r.texto} — {r.clips.length} veces (clips {r.clips.join(", ")})
                    </li>
                  )),
                )}
              </ul>
            </div>
          )}

          <div className="pt-2">
            <h4 className="mb-1 text-sm font-bold text-white">Dónde caen · {CARPETAS.find((c) => c.key === carpeta)?.corto}</h4>
            <p className="mb-2 text-xs text-white/55">
              {!jornada
                ? "La carpeta no dice la jornada: no se lleva a la pizarra."
                : hayTablero
                  ? `Va sola a la pizarra de la J${jornada}: ${nuevasCaidas.length} diapositiva${nuevasCaidas.length === 1 ? "" : "s"} «Dónde caen», al final.`
                  : `Aún no hay pizarra de la J${jornada}: ábrela en Pizarra ABP y las caídas entrarán solas.`}
            </p>
            <CampogramaCaidas
              titulo={`${rival || equipo || "Rival"} · ${CARPETAS.find((c) => c.key === carpeta)?.corto ?? carpeta}`}
              clips={porCarpeta.get(carpeta) ?? []}
              defensivo={CARPETAS.find((c) => c.key === carpeta)?.fase === "def"}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={!descartados.length || moviendo}
              onClick={() => void mueveDescartados()}
              className="flex items-center gap-1.5 rounded-lg border border-red-400/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-40"
            >
              <Trash2 size={14} /> {moviendo ? "Moviendo…" : `Mover ${descartados.length} descartados a «_descartados»`}
            </button>
            <button
              type="button"
              disabled={!elegidos || copiando}
              onClick={() => void copiaElegidos()}
              title="Copia los elegidos a CLIPS SELECCIONADOS, en una carpeta «J10 - CARTAGENA» con una subcarpeta por tipo"
              className="flex items-center gap-1.5 rounded-lg border border-[#D8B45A]/50 px-3 py-1.5 text-sm text-[#D8B45A] hover:bg-[#D8B45A]/10 disabled:opacity-40"
            >
              <FolderOpen size={14} /> {copiando ? "Copiando…" : `Copiar ${elegidos} elegidos a «CLIPS SELECCIONADOS»`}
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
          {elegidos || aMano ? (
            <textarea
              value={texto}
              onChange={(e) => {
                const nuevo = e.target.value;

                setDoc((d) => ({ ...d, texto: nuevo, textoBase: typeof d.texto === "string" ? d.textoBase : automatico }));
              }}
              spellCheck
              aria-label="Texto para el cuerpo técnico (se puede escribir)"
              className="h-[40vh] w-full resize-y rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[12px] leading-relaxed text-white/85 outline-none focus:border-[#D8B45A]/60"
            />
          ) : (
            <p className="rounded-lg bg-black/30 p-3 text-[12px] text-white/50">Aún no hay elegidos.</p>
          )}
          {aMano && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/55">
              <span>{cambiadoDetras ? "Escrito a mano · las etiquetas han cambiado desde entonces" : "Escrito a mano"}</span>
              <button
                type="button"
                onClick={() => setDoc((d) => ({ ...d, texto: undefined, textoBase: undefined }))}
                className="flex items-center gap-1 text-[#D8B45A] hover:underline"
              >
                <RotateCcw size={11} /> Volver al automático
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!texto.trim()}
              onClick={() => void navigator.clipboard.writeText(texto).then(() => toast.success("Texto copiado"))}
              className="flex items-center gap-1.5 rounded-lg bg-[#D8B45A] px-3 py-1.5 text-sm font-bold text-[#0B0F14] disabled:opacity-40"
            >
              <ClipboardCopy size={14} /> Copiar
            </button>
            <button
              type="button"
              disabled={!texto.trim()}
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener")}
              title="Abre WhatsApp con el texto escrito para elegir a quién va"
              className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-bold text-[#0B0F14] disabled:opacity-40"
            >
              <MessageCircle size={14} /> WhatsApp
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
