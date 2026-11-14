"use client";

/**
 * EL RETRATO 3D DEL PARTIDO (14/11/2026; sustituye al relieve, mismo nombre y
 * mismos sitios: directo, «todos a la vez» y Post del partido).
 *
 * El campo entero como superficie en perspectiva (canvas, 60 fps): cada zona
 * del color del equipo que la domina en los últimos minutos y alta según la
 * actividad (lib/opta-retrato.ts); los remates levantan un bulto y el gol, un
 * destello blanco. La cámara gira despacio y el partido corre en bucle.
 * Marcador con los colores arriba a la izquierda, minuto y parte a la
 * derecha, curva de dominio abajo.
 *
 * Colores (petición del analista: «con el que juegue ese partido»): primero
 * los que se hayan fijado a mano para ese partido (opta:colores, lo cambia el
 * administrador aquí mismo); si no, el Castilla de blanco en casa y de verde
 * fuera (segunda equipación 26/27) y el rival con el teamColor de Opta.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

import { useAdmin } from "@/hooks/useAdmin";
import { leeEventos, type JugadorDirecto } from "@/lib/opta-directo-mapas";
import { CASTILLA_OPTA, traeOpta, type TablaOpta } from "@/lib/opta";
import { GX, GY, retrato, ventana } from "@/lib/opta-retrato";

type Equipo = { teamId: string; nombre: string; color?: string; campo?: string };
type RGB = [number, number, number];

const CASTILLA_CASA = "#F2F2F2";
const CASTILLA_FUERA = "#1FA35B";
const DEF_A: RGB = [236, 194, 92];
const DEF_B: RGB = [236, 84, 88];

const deHex = (h: string | undefined): RGB | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec((h ?? "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const aHex = (c: RGB) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const dist = (x: RGB, y: RGB) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
const luz = (c: RGB) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const css = (c: RGB, a = 1) => `rgba(${c.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(",")},${a})`;

function colorBase(eq: Equipo, fijado: string | undefined, porDefecto: RGB): RGB {
  const f = deHex(fijado);
  if (f) return f;
  if (eq.teamId === CASTILLA_OPTA) return deHex(/away/i.test(eq.campo ?? "") ? CASTILLA_FUERA : /home/i.test(eq.campo ?? "") ? CASTILLA_CASA : CASTILLA_FUERA)!;
  return deHex(eq.color) ?? porDefecto;
}
function dosColores(a: Equipo, b: Equipo, fijados: Record<string, string>): [RGB, RGB] {
  let ca = colorBase(a, fijados[a.teamId], DEF_A);
  let cb = colorBase(b, fijados[b.teamId], DEF_B);
  /* Sobre fondo negro, el negro no se ve. */
  if (luz(ca) < 50) ca = [150, 150, 160];
  if (luz(cb) < 50) cb = [150, 150, 160];
  if (dist(ca, cb) < 90 && !fijados[b.teamId]) cb = luz(cb) > 140 ? (cb.map((v) => v * 0.45) as RGB) : (cb.map((v) => v + (255 - v) * 0.6) as RGB);
  return [ca, cb];
}

const SEGUNDOS_PARTIDO = 30; // a ×1
const PAUSA_FINAL = 2000;

export function RelievePartido({
  eventos,
  a,
  b,
  jugadores,
  compacto = false,
  partido,
}: {
  eventos: TablaOpta | null | undefined;
  a: Equipo;
  b: Equipo;
  jugadores?: Map<string, JugadorDirecto>;
  compacto?: boolean;
  /** Id de Opta del partido: para los colores fijados a mano. */
  partido?: string;
}) {
  const ev = useMemo(() => leeEventos(eventos), [eventos]);
  const r = useMemo(() => retrato(ev, a.teamId, b.teamId), [ev, a.teamId, b.teamId]);
  const fin = r.minutos - 1;
  const { admin } = useAdmin();

  /* Colores fijados a mano por partido. */
  const [fijados, setFijados] = useState<Record<string, Record<string, string>>>({});
  useEffect(() => {
    let vivo = true;
    void traeOpta<Record<string, Record<string, string>>>("opta:colores").then((d) => {
      if (vivo && d && typeof d === "object") setFijados(d);
    });
    return () => {
      vivo = false;
    };
  }, []);
  const delPartido = useMemo(() => (partido ? (fijados[partido] ?? {}) : {}), [fijados, partido]);
  const [colA, colB] = useMemo(() => dosColores(a, b, delPartido), [a, b, delPartido]);
  const fija = async (teamId: string, hex: string) => {
    if (!partido) return;
    const nuevo = { ...fijados, [partido]: { ...(fijados[partido] ?? {}), [teamId]: hex } };
    setFijados(nuevo);
    await fetch("/api/docs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "opta:colores", kind: "opta", data: nuevo }) }).catch(() => null);
  };

  const lienzo = useRef<HTMLCanvasElement>(null);
  const [jugando, setJugando] = useState(true);
  const [velocidad, setVelocidad] = useState(1);
  const [minuto, setMinuto] = useState(0);
  const estado = useRef({ t: 0, quieto: 0 });
  const mandos = useRef({ jugando: true, velocidad: 1, saltar: null as number | null });
  useEffect(() => {
    mandos.current.jugando = jugando;
    mandos.current.velocidad = velocidad;
  }, [jugando, velocidad]);

  useEffect(() => {
    const cv = lienzo.current;
    if (!cv || r.minutos < 2) return;
    const W = compacto ? 480 : 1000;
    const H = compacto ? 270 : 560;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr;
    cv.height = H * dpr;
    const g = cv.getContext("2d");
    if (!g) return;
    g.scale(dpr, dpr);

    const N = GX * GY;
    const alto = new Float32Array(N);
    let escala = r.escala;
    const inicio = performance.now();
    let ultimo = inicio;
    let pedido = 0;
    let minutoPintado = -1;

    /* Mundo en metros: X a lo largo (A ataca a +X), Z a lo ancho (y de Opta = 0 a la derecha del que ataca, abajo), Y arriba. */
    const mundo = (i: number, j: number, h: number): [number, number, number] => [(i / (GX - 1) - 0.5) * 105, h * 24, (j / (GY - 1) - 0.5) * 68];
    const proyecta = (X: number, Y: number, Z: number, giro: number): [number, number, number] => {
      const c = Math.cos(giro);
      const s = Math.sin(giro);
      const x1 = X * c - Z * s;
      const z1 = X * s + Z * c;
      const fi = 0.82;
      const prof = -z1 * Math.cos(fi) - Y * Math.sin(fi);
      const f = 170 / (170 + prof);
      const esc = (compacto ? 3.1 : 6.3) * f;
      return [W / 2 + x1 * esc, H * 0.56 + (z1 * Math.sin(fi) - Y * Math.cos(fi)) * esc, prof];
    };
    const altoEn = (px: number, py: number) => {
      const i = Math.min(GX - 1, Math.max(0, Math.round((px / 100) * (GX - 1))));
      const j = Math.min(GY - 1, Math.max(0, Math.round((py / 100) * (GY - 1))));
      return alto[j * GX + i];
    };
    /* Las líneas del campo, en % (x a lo largo, y a lo ancho). */
    const lineas: [number, number][][] = [
      [[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]],
      [[50, 0], [50, 100]],
      [[0, 20.4], [15.7, 20.4], [15.7, 79.6], [0, 79.6]],
      [[100, 20.4], [84.3, 20.4], [84.3, 79.6], [100, 79.6]],
      [[0, 36.5], [5.2, 36.5], [5.2, 63.5], [0, 63.5]],
      [[100, 36.5], [94.8, 36.5], [94.8, 63.5], [100, 63.5]],
      Array.from({ length: 33 }, (_, k) => [50 + (9.15 / 1.05) * Math.cos((k / 32) * Math.PI * 2), 50 + (9.15 / 0.68) * Math.sin((k / 32) * Math.PI * 2)] as [number, number]),
    ];

    const pinta = (ahora: number) => {
      const t = estado.current.t;
      const { total, parteA } = ventana(r, Math.min(fin, t));
      /* Escala que se mueve despacio (sin parpadeos). */
      let max = 0;
      for (let i = 0; i < N; i++) max = Math.max(max, total[i]);
      escala = escala * 0.97 + Math.max(r.escala * 0.35, max) * 0.03;
      for (let i = 0; i < N; i++) alto[i] = 0.5 * Math.sqrt(total[i] / escala);
      /* Los remates de los 3 últimos minutos: un bulto por su xG. */
      const destellos: { i: number; j: number; k: number; deA: boolean }[] = [];
      for (const s of r.tiros) {
        const d = t - s.minuto;
        if (d < 0 || d > 3) continue;
        const amp = (0.25 + 0.75 * Math.min(1, Math.sqrt(s.xg / 0.6))) * (1 - d / 3);
        for (let dj = -5; dj <= 5; dj++)
          for (let di = -5; di <= 5; di++) {
            const i = s.gx + di;
            const j = s.gy + dj;
            if (i < 0 || i >= GX || j < 0 || j >= GY) continue;
            alto[j * GX + i] += amp * Math.exp(-(di * di + dj * dj) / 6);
          }
        if (s.gol) destellos.push({ i: s.gx, j: s.gy, k: 1 - d / 3, deA: s.deA });
      }

      const giro = -0.42 + 0.32 * Math.sin((ahora - inicio) / 9000);
      g.clearRect(0, 0, W, H);
      const fondo = g.createRadialGradient(W / 2, H * 0.5, 40, W / 2, H * 0.5, W * 0.7);
      fondo.addColorStop(0, "#14131f");
      fondo.addColorStop(1, "#05050a");
      g.fillStyle = fondo;
      g.fillRect(0, 0, W, H);

      /* Las caras, de la más lejana a la más cercana. */
      const caras: { d: number; p: [number, number][]; col: string }[] = [];
      for (let j = 0; j < GY - 1; j++)
        for (let i = 0; i < GX - 1; i++) {
          const k = j * GX + i;
          const hs = [alto[k], alto[k + 1], alto[k + GX + 1], alto[k + GX]];
          const pts = [mundo(i, j, hs[0]), mundo(i + 1, j, hs[1]), mundo(i + 1, j + 1, hs[2]), mundo(i, j + 1, hs[3])].map(([X, Y, Z]) => proyecta(X, Y, Z, giro));
          const p = (parteA[k] + parteA[k + 1] + parteA[k + GX] + parteA[k + GX + 1]) / 4;
          const q = Math.min(1, Math.max(0, (p - 0.3) / 0.4));
          const base = [0, 1, 2].map((c) => colA[c] * q + colB[c] * (1 - q));
          const pendiente = (hs[1] + hs[2] - hs[0] - hs[3]) * 0.9 + (hs[2] + hs[3] - hs[0] - hs[1]) * 0.6;
          const ilum = Math.max(0.35, Math.min(1.25, 0.78 + pendiente * 2.2 + (hs[0] + hs[2]) * 0.25));
          const vida = Math.min(1, 0.45 + Math.sqrt(total[k] / escala) * 0.9);
          caras.push({ d: (pts[0][2] + pts[2][2]) / 2, p: pts.map(([x, y]) => [x, y] as [number, number]), col: css(base.map((v) => v * ilum * vida) as RGB) });
        }
      caras.sort((x, y) => y.d - x.d);
      for (const c of caras) {
        g.fillStyle = c.col;
        g.beginPath();
        g.moveTo(c.p[0][0], c.p[0][1]);
        for (let n = 1; n < 4; n++) g.lineTo(c.p[n][0], c.p[n][1]);
        g.closePath();
        g.fill();
        if (!compacto) {
          g.strokeStyle = "rgba(0,0,0,0.18)";
          g.lineWidth = 0.4;
          g.stroke();
        }
      }
      /* Las líneas del campo, pegadas a la superficie. */
      g.strokeStyle = "rgba(255,255,255,0.55)";
      g.lineWidth = compacto ? 0.6 : 1.1;
      for (const l of lineas) {
        g.beginPath();
        for (let n = 0; n < l.length - 1; n++) {
          const [x0, y0] = l[n];
          const [x1, y1] = l[n + 1];
          const pasos = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
          for (let s = 0; s <= pasos; s++) {
            const x = x0 + ((x1 - x0) * s) / pasos;
            const y = y0 + ((y1 - y0) * s) / pasos;
            const [X, Y, Z] = mundo((x / 100) * (GX - 1), (y / 100) * (GY - 1), altoEn(x, y) + 0.01);
            const [sx, sy] = proyecta(X, Y, Z, giro);
            if (n === 0 && s === 0) g.moveTo(sx, sy);
            else g.lineTo(sx, sy);
          }
        }
        g.stroke();
      }
      /* El gol: destello blanco. */
      for (const d of destellos) {
        const [X, Y, Z] = mundo(d.i, d.j, alto[d.j * GX + d.i] + 0.15);
        const [sx, sy] = proyecta(X, Y, Z, giro);
        const rad = (compacto ? 14 : 34) * (0.6 + 0.4 * d.k);
        const gr = g.createRadialGradient(sx, sy, 0, sx, sy, rad);
        gr.addColorStop(0, `rgba(255,255,255,${0.95 * d.k})`);
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(sx, sy, rad, 0, Math.PI * 2);
        g.fill();
      }
      /* La curva de dominio, abajo a la izquierda. */
      if (!compacto) {
        const cx0 = 24;
        const cw = 260;
        const cy0 = H - 40;
        const tope = Math.max(1, ...r.curva.map(Math.abs));
        for (let m = 0; m < r.minutos - 1; m++) {
          const v = r.curva[m];
          const x = cx0 + (m / fin) * cw;
          g.fillStyle = css(v >= 0 ? colA : colB, m <= t ? 0.9 : 0.25);
          const h = (Math.abs(v) / tope) * 22;
          g.fillRect(x, v >= 0 ? cy0 - h : cy0, cw / fin + 0.5, h);
        }
        g.fillStyle = "#FFFFFF";
        g.fillRect(cx0 + (Math.min(fin, t) / fin) * cw, cy0 - 26, 1.5, 52);
      }
    };

    const vuelta = (ahora: number) => {
      const dt = Math.min(100, ahora - ultimo);
      ultimo = ahora;
      const s = estado.current;
      const m = mandos.current;
      if (m.saltar != null) {
        s.t = m.saltar;
        m.saltar = null;
      } else if (m.jugando) {
        if (s.t >= fin) {
          s.quieto += dt;
          if (s.quieto >= PAUSA_FINAL) {
            s.t = 0;
            s.quieto = 0;
          }
        } else s.t = Math.min(fin, s.t + (dt / 1000) * (fin / SEGUNDOS_PARTIDO) * m.velocidad);
      }
      pinta(ahora);
      const mm = Math.floor(s.t);
      if (mm !== minutoPintado) {
        minutoPintado = mm;
        setMinuto(mm);
      }
      pedido = requestAnimationFrame(vuelta);
    };
    pedido = requestAnimationFrame(vuelta);
    return () => cancelAnimationFrame(pedido);
  }, [r, fin, compacto, colA, colB]);

  const golesA = r.tiros.filter((p) => p.gol && p.deA && p.minuto <= minuto).length;
  const golesB = r.tiros.filter((p) => p.gol && !p.deA && p.minuto <= minuto).length;
  const golAhora = r.tiros.find((p) => p.gol && minuto - p.minuto >= 0 && minuto - p.minuto < 3);
  const nombre = (id: string) => jugadores?.get(id)?.nombre ?? "";
  const parte = minuto <= 45 ? "1.ª PARTE" : "2.ª PARTE";

  if (ev.length < 20) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ background: "#05050a" }}>
      <canvas ref={lienzo} className="block h-auto w-full" style={{ aspectRatio: compacto ? "480 / 270" : "1000 / 560" }} role="img" aria-label={`Retrato 3D del partido ${a.nombre} - ${b.nombre}, animado`} />
      {/* Marcador, como en la tele. */}
      <div className={`pointer-events-none absolute left-3 top-3 ${compacto ? "" : "sm:left-6 sm:top-5"}`}>
        <div className="flex gap-4">
          {[
            [a.nombre, golesA, colA],
            [b.nombre, golesB, colB],
          ].map(([n, gl, c]) => (
            <div key={String(n)} className="min-w-0">
              <p className={`truncate font-bold ${compacto ? "max-w-[90px] text-[10px]" : "max-w-[160px] text-xs"}`} style={{ color: "#FFFFFF" }}>
                {String(n)}
              </p>
              <span className="mt-0.5 block h-1 rounded-full" style={{ background: css(c as RGB) }} />
              <p className={`font-mono font-black tabular-nums ${compacto ? "text-2xl" : "text-5xl"}`} style={{ color: "#FFFFFF" }}>
                {String(gl)}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className={`pointer-events-none absolute right-3 top-3 text-right ${compacto ? "" : "sm:right-6 sm:top-5"}`}>
        <p className={`font-mono font-black tabular-nums ${compacto ? "text-xl" : "text-4xl"}`} style={{ color: "#FFFFFF" }}>
          {minuto}′
        </p>
        <p className="text-[10px] font-semibold tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.55)" }}>
          {parte}
        </p>
      </div>
      {golAhora && !compacto && (
        <div className="pointer-events-none absolute inset-x-0 top-[38%] text-center text-4xl font-black" style={{ color: css(golAhora.deA ? colA : colB) }}>
          ¡GOL! {nombre(golAhora.jugadorId)}
        </div>
      )}
      {!compacto && (
        <div className="absolute bottom-3 right-3 flex flex-wrap items-center justify-end gap-2 sm:right-5">
          <button type="button" onClick={() => setJugando((j) => !j)} aria-label={jugando ? "Pausa" : "Reproducir"} className="inline-flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "#FFFFFF", color: "#000000" }}>
            {jugando ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            onClick={() => {
              mandos.current.saltar = 0;
              setJugando(true);
            }}
            aria-label="Desde el principio"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.18)", color: "#FFFFFF" }}
          >
            <RotateCcw size={15} />
          </button>
          <button type="button" onClick={() => setVelocidad((v) => (v >= 4 ? 0.5 : v * 2))} className="h-9 rounded-full px-3 text-xs font-bold" style={{ background: "rgba(255,255,255,0.18)", color: "#FFFFFF" }}>
            ×{String(velocidad).replace(".", ",")}
          </button>
          <input
            type="range"
            min={0}
            max={fin}
            step={1}
            value={minuto}
            onChange={(e) => {
              setJugando(false);
              mandos.current.saltar = Number(e.target.value);
            }}
            aria-label="Minuto del partido"
            className="w-32 accent-white sm:w-48"
          />
          {admin && partido && (
            <span className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px]" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)" }} title="Color de cada equipo en este partido (se guarda para todos)">
              Colores
              <input type="color" value={aHex(colA)} onChange={(e) => void fija(a.teamId, e.target.value)} aria-label={`Color de ${a.nombre}`} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent" />
              <input type="color" value={aHex(colB)} onChange={(e) => void fija(b.teamId, e.target.value)} aria-label={`Color de ${b.nombre}`} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
