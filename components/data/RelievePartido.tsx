"use client";

/**
 * EL PARTIDO EN RELIEVE (14/11/2026): el dibujo de `lib/opta-relieve.ts`, animado.
 *
 * Una superficie en perspectiva dibujada en canvas (fluido a 60 fps): de
 * izquierda a derecha el minuto, hacia el fondo el carril del campo, en altura
 * la presión. Se levanta minuto a minuto como una ola (el frente sube con un
 * pequeño rebote) y vuelve a empezar en bucle, en todas partes. Cada equipo
 * con el color con el que jugó ese partido (Opta, `teamColor` en opta:directo;
 * si los dos se parecen, el segundo se aclara u oscurece; sin dato, oro y
 * rojo). Cada pico es un remate; el gol, bola blanca y rótulo.
 * `compacto` = la versión pequeña (varios partidos a la vez), sin mandos.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

import { leeEventos, type JugadorDirecto } from "@/lib/opta-directo-mapas";
import type { TablaOpta } from "@/lib/opta";
import { CARRILES, relieve } from "@/lib/opta-relieve";

type Equipo = { teamId: string; nombre: string; color?: string };
type RGB = [number, number, number];

const POR_DEFECTO_A: RGB = [236, 194, 92];
const POR_DEFECTO_B: RGB = [236, 84, 88];
const GRIS: RGB = [62, 70, 66];

const deHex = (h: string | undefined, otro: RGB): RGB => {
  const m = /^#?([0-9a-f]{6})$/i.exec((h ?? "").trim());
  if (!m) return otro;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const distancia = (x: RGB, y: RGB) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
/* Un color que se vea sobre el fondo oscuro (el negro de una camiseta, en gris claro). */
const visible = (c: RGB): RGB => {
  const luz = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  return luz < 60 ? [150, 150, 160] : c;
};
const rgb = (c: RGB, a = 1) => `rgba(${c.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(",")},${a})`;

/** Los dos colores del partido, distinguibles entre sí. */
function coloresDe(a: Equipo, b: Equipo): [RGB, RGB] {
  const ca = visible(deHex(a.color, POR_DEFECTO_A));
  let cb = visible(deHex(b.color, POR_DEFECTO_B));
  if (distancia(ca, cb) < 90) {
    const luz = 0.299 * cb[0] + 0.587 * cb[1] + 0.114 * cb[2];
    cb = luz > 140 ? (cb.map((v) => v * 0.45) as RGB) : (cb.map((v) => v + (255 - v) * 0.6) as RGB);
    if (distancia(ca, cb) < 90) cb = POR_DEFECTO_B;
  }
  return [ca, cb];
}

/** Rebote suave del frente de la ola. */
const ola = (x: number) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

const SEGUNDOS_PARTIDO = 12; // a ×1
const PAUSA_FINAL = 1800; // ms quieto al acabar antes de volver a empezar

export function RelievePartido({
  eventos,
  a,
  b,
  jugadores,
  compacto = false,
}: {
  eventos: TablaOpta | null | undefined;
  a: Equipo;
  b: Equipo;
  jugadores?: Map<string, JugadorDirecto>;
  compacto?: boolean;
}) {
  const ev = useMemo(() => leeEventos(eventos), [eventos]);
  const r = useMemo(() => relieve(ev, a.teamId, b.teamId), [ev, a.teamId, b.teamId]);
  const [colA, colB] = useMemo(() => coloresDe(a, b), [a, b]);
  const fin = r.minutos - 1;

  const lienzo = useRef<HTMLCanvasElement>(null);
  const [jugando, setJugando] = useState(true);
  const [velocidad, setVelocidad] = useState(1);
  /* Lo que se enseña fuera del lienzo (reloj y marcador), sólo cuando cambia el minuto. */
  const [minuto, setMinuto] = useState(0);
  const estado = useRef({ hasta: 0, quieto: 0 });
  const mandos = useRef({ jugando: true, velocidad: 1, saltar: null as number | null });
  useEffect(() => {
    mandos.current.jugando = jugando;
    mandos.current.velocidad = velocidad;
  }, [jugando, velocidad]);

  useEffect(() => {
    const cv = lienzo.current;
    if (!cv || r.minutos < 2) return;
    const W = compacto ? 420 : 1000;
    const H = compacto ? 150 : 320;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr;
    cv.height = H * dpr;
    const g = cv.getContext("2d");
    if (!g) return;
    g.scale(dpr, dpr);

    const sx = compacto ? 9 : 22;
    const sy = compacto ? 6 : 14;
    const alto = compacto ? 70 : 170;
    const x0 = compacto ? 10 : 46;
    const y0 = H - (compacto ? 16 : 40);
    const dx = (W - x0 - 20 - sx * (CARRILES - 1)) / fin;
    const P = (t: number, c: number, h: number): [number, number] => [x0 + t * dx + c * sx, y0 - c * sy - h * alto];
    const nombre = (id: string) => jugadores?.get(id)?.nombre ?? "";

    let ultimo = performance.now();
    let pedido = 0;
    let minutoPintado = -1;

    const pinta = () => {
      const { hasta } = estado.current;
      /* El frente de la ola: lo pasado, del todo; los 3 minutos del frente, subiendo con rebote. */
      const sube = (t: number) => ola((hasta - t + 0.5) / 3);
      g.clearRect(0, 0, W, H);
      g.fillStyle = "#0B1410";
      g.beginPath();
      g.roundRect(0, 0, W, H, compacto ? 10 : 16);
      g.fill();
      for (const m of [0, 15, 30, 45, 60, 75, 90]) {
        if (m > fin) continue;
        const [x1, y1] = P(m, 0, 0);
        const [x2, y2] = P(m, CARRILES - 1, 0);
        g.strokeStyle = m === 45 ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)";
        g.setLineDash(m === 45 ? [4, 4] : []);
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
        if (!compacto) {
          g.fillStyle = "rgba(255,255,255,0.55)";
          g.font = "12px system-ui, sans-serif";
          g.textAlign = "center";
          g.fillText(m === 45 ? "Descanso" : `${m}′`, x1, y1 + 18);
        }
      }
      g.setLineDash([]);
      g.lineWidth = compacto ? 0.3 : 0.5;
      g.strokeStyle = "rgba(0,0,0,0.28)";
      for (let c = CARRILES - 2; c >= 0; c--)
        for (let t = 0; t < fin; t++) {
          const f0 = sube(t);
          const f1 = sube(t + 1);
          const h0 = r.altura[t][c] * f0;
          const h1 = r.altura[t + 1][c] * f1;
          const h2 = r.altura[t + 1][c + 1] * f1;
          const h3 = r.altura[t][c + 1] * f0;
          const p = (r.parteA[t][c] + r.parteA[t + 1][c] + r.parteA[t][c + 1] + r.parteA[t + 1][c + 1]) / 4;
          const hm = Math.max(0, (h0 + h1 + h2 + h3) / 4);
          const base: RGB = [0, 1, 2].map((i) => colA[i] * p + colB[i] * (1 - p)) as RGB;
          const k = Math.min(1, hm / 0.35);
          const luz = 0.72 + 0.4 * Math.min(1, hm);
          const col = base.map((v, i) => (GRIS[i] * (1 - k) + v * k) * luz) as RGB;
          const q = [P(t, c, h0), P(t + 1, c, h1), P(t + 1, c + 1, h2), P(t, c + 1, h3)];
          g.fillStyle = rgb(col);
          g.beginPath();
          g.moveTo(q[0][0], q[0][1]);
          for (let i = 1; i < 4; i++) g.lineTo(q[i][0], q[i][1]);
          g.closePath();
          g.fill();
          g.stroke();
        }
      /* Los goles que ya han pasado: bola y rótulo; el último, más grande un momento. */
      for (const p of r.picos) {
        if (!p.gol || p.minuto > hasta) continue;
        const h = Math.max(...[-1, 0, 1].map((dc) => r.altura[p.minuto]?.[Math.min(CARRILES - 1, Math.max(0, p.carril + dc))] ?? 0)) * sube(p.minuto);
        const [x, y] = P(p.minuto, p.carril, h);
        const reciente = hasta - p.minuto < 4;
        g.fillStyle = "#FFFFFF";
        g.strokeStyle = rgb(p.deA ? colA : colB);
        g.lineWidth = 3;
        g.beginPath();
        g.arc(x, y, compacto ? 3 : reciente ? 9 : 6, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        if (!compacto) {
          g.fillStyle = "#FFFFFF";
          g.font = "bold 12px system-ui, sans-serif";
          g.textAlign = "center";
          g.fillText(`GOL ${p.minuto}′${nombre(p.jugadorId) ? ` ${nombre(p.jugadorId).split(" ").slice(-1)[0]}` : ""}`, x, y - 14);
        }
      }
      if (!compacto) {
        g.textAlign = "right";
        g.font = "bold 14px system-ui, sans-serif";
        g.fillStyle = rgb(colA);
        g.fillText(a.nombre, W - 16, 26);
        g.fillStyle = rgb(colB);
        g.fillText(b.nombre, W - 16, 46);
      }
    };

    const vuelta = (ahora: number) => {
      const dt = Math.min(100, ahora - ultimo);
      ultimo = ahora;
      const s = estado.current;
      const m = mandos.current;
      if (m.saltar != null) {
        s.hasta = m.saltar;
        m.saltar = null;
      } else if (m.jugando) {
        if (s.hasta >= fin + 3) {
          s.quieto += dt;
          if (s.quieto >= PAUSA_FINAL) {
            s.hasta = 0;
            s.quieto = 0;
          }
        } else s.hasta = Math.min(fin + 3, s.hasta + (dt / 1000) * (fin / SEGUNDOS_PARTIDO) * m.velocidad);
      }
      pinta();
      const mm = Math.min(fin, Math.floor(s.hasta));
      if (mm !== minutoPintado) {
        minutoPintado = mm;
        setMinuto(mm);
      }
      pedido = requestAnimationFrame(vuelta);
    };
    pedido = requestAnimationFrame(vuelta);
    return () => cancelAnimationFrame(pedido);
  }, [r, fin, compacto, colA, colB, a.nombre, b.nombre, jugadores]);

  const golesA = r.picos.filter((p) => p.gol && p.deA && p.minuto <= minuto).length;
  const golesB = r.picos.filter((p) => p.gol && !p.deA && p.minuto <= minuto).length;

  if (ev.length < 20) return null;
  return (
    <div className="relative">
      {!compacto && (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setJugando((j) => !j)}
            aria-label={jugando ? "Pausa" : "Reproducir"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "#FFFFFF", color: "#000000" }}
          >
            {jugando ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            onClick={() => {
              mandos.current.saltar = 0;
              setJugando(true);
            }}
            aria-label="Desde el principio"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.18)", color: "#FFFFFF" }}
          >
            <RotateCcw size={15} />
          </button>
          <button type="button" onClick={() => setVelocidad((v) => (v >= 4 ? 0.5 : v * 2))} className="h-9 rounded-full px-3 text-xs font-bold" style={{ background: "rgba(255,255,255,0.18)", color: "#FFFFFF" }}>
            ×{String(velocidad).replace(".", ",")}
          </button>
          <span className="ml-1 font-mono text-2xl font-bold tabular-nums" style={{ color: "#FFFFFF" }}>{minuto}′</span>
          <span className="text-2xl font-bold tabular-nums">
            <span style={{ color: rgb(colA) }}>{golesA}</span>
            <span style={{ color: "rgba(255,255,255,0.6)" }}>-</span>
            <span style={{ color: rgb(colB) }}>{golesB}</span>
          </span>
        </div>
      )}
      <canvas ref={lienzo} className="block h-auto w-full" style={{ aspectRatio: compacto ? "420 / 150" : "1000 / 320" }} role="img" aria-label={`El partido en relieve: ${a.nombre} contra ${b.nombre}, animado`} />
      {!compacto && (
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
          className="absolute bottom-2 left-1/2 z-10 w-1/2 -translate-x-1/2 accent-[#ECC25C]"
        />
      )}
    </div>
  );
}
