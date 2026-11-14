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
import { GX, GY, retrato, ventana, type TiroRetrato } from "@/lib/opta-retrato";

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
  const [modo, setModo] = useState<"app" | "camisetas">(() => {
    if (typeof window === "undefined") return "app";
    try {
      return localStorage.getItem("rmcf:3d-colores") === "camisetas" ? "camisetas" : "app";
    } catch {
      return "app";
    }
  });
  const cambiaModo = (m: "app" | "camisetas") => {
    setModo(m);
    try {
      localStorage.setItem("rmcf:3d-colores", m);
    } catch {
      /* nada */
    }
  };
  /* Colores de la app (petición del analista): el nuestro (o el de la izquierda) en oro y el otro en blanco hielo. */
  const [colA, colB] = useMemo<[RGB, RGB]>(() => (modo === "app" ? [[214, 178, 104], [226, 232, 240]] : dosColores(a, b, delPartido)), [modo, a, b, delPartido]);
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
  const [aviso, setAviso] = useState<(TiroRetrato & { en: number }) | null>(null);
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
    const suave = new Float32Array(N);
    let escala = r.escala;
    const inicio = performance.now();
    let ultimo = inicio;
    let pedido = 0;
    let minutoPintado = -1;
    let anterior = -1;

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

    /* MICROBOLITAS (14/11/2026, petición del analista: «como el vídeo»): la superficie no son
       baldosas sino ~30.000 puntos finos, escritos directamente en los píxeles con su
       profundidad (el de delante tapa al de detrás), cada uno con su luz. Fluido y fino. */
    const DX = compacto ? 150 : 270;
    const DY = compacto ? 96 : 174;
    const PW = Math.round(W * dpr);
    const PH = Math.round(H * dpr);
    const img = g.createImageData(PW, PH);
    const px = new Uint32Array(img.data.buffer);
    const zbuf = new Float32Array(PW * PH);
    /* EL FONDO (14/11/2026, más elegante): noche azul limpia, dos haces de luz de estadio que
       caen suaves desde arriba, un horizonte de grada apenas insinuado y viñeta. */
    const fondo = new Uint32Array(PW * PH);
    for (let y = 0; y < PH; y++)
      for (let x = 0; x < PW; x++) {
        const u = x / PW;
        const v = y / PH;
        let R = 6 + 10 * (1 - v);
        let G = 9 + 14 * (1 - v);
        let B = 22 + 30 * (1 - v);
        /* Haces de luz: conos suaves desde las esquinas de arriba. */
        for (const [fx, dir] of [
          [0.12, 1],
          [0.88, -1],
        ]) {
          const dx = u - fx - dir * v * 0.35;
          const k = Math.exp(-(dx * dx) / (0.012 + v * 0.05)) * (1 - v) * 0.9;
          R += k * 38;
          G += k * 42;
          B += k * 52;
        }
        /* La grada: una banda curva apenas más clara. */
        const borde = 0.3 + 0.1 * Math.pow(Math.abs(u - 0.5) * 2, 2);
        const g0 = Math.exp(-Math.pow((v - borde) / 0.05, 2));
        R += g0 * 10;
        G += g0 * 12;
        B += g0 * 16;
        const sombra = Math.exp(-Math.pow((u - 0.5) / 0.4, 2) - Math.pow((v - 0.7) / 0.14, 2));
        R *= 1 - 0.6 * sombra;
        G *= 1 - 0.6 * sombra;
        B *= 1 - 0.5 * sombra;
        const c = Math.hypot((u - 0.5) * 1.2, (v - 0.55) * 1.5);
        const osc = Math.max(0.35, 1 - c * 0.7);
        fondo[y * PW + x] = (255 << 24) | (Math.round(Math.min(255, B * osc)) << 16) | (Math.round(Math.min(255, G * osc)) << 8) | Math.round(Math.min(255, R * osc));
      }
    const brillo = document.createElement("canvas");
    brillo.width = Math.round(W / 3);
    brillo.height = Math.round(H / 3);
    const gg = brillo.getContext("2d");
    const tam = Math.max(1, Math.round((compacto ? 1.1 : 1.35) * dpr));
    const bil = (arr: Float32Array, u: number, v: number) => {
      const fx = u * (GX - 1);
      const fy = v * (GY - 1);
      const i = Math.min(GX - 2, Math.floor(fx));
      const j = Math.min(GY - 2, Math.floor(fy));
      const tx = fx - i;
      const ty = fy - j;
      const k = j * GX + i;
      return (arr[k] * (1 - tx) + arr[k + 1] * tx) * (1 - ty) + (arr[k + GX] * (1 - tx) + arr[k + GX + 1] * tx) * ty;
    };

    const pinta = (ahora: number) => {
      const t = estado.current.t;
      const { total, parteA } = ventana(r, Math.min(fin, t));
      let max = 0;
      for (let i = 0; i < N; i++) max = Math.max(max, total[i]);
      escala = escala * 0.97 + Math.max(r.escala * 0.35, max) * 0.03;
      /* Fluir como el mar: cada punto va hacia su altura poco a poco (sin golpes) y encima
         un oleaje suave que nunca para. */
      const fase = (ahora - inicio) / 1000;
      for (let i = 0; i < N; i++) {
        const objetivo = 0.5 * Math.sqrt(total[i] / escala);
        suave[i] += (objetivo - suave[i]) * 0.06;
        const ii = i % GX;
        const jj = (i - ii) / GX;
        alto[i] = suave[i] + 0.018 * Math.sin(ii * 0.32 + fase * 1.3) * Math.cos(jj * 0.27 - fase * 0.9);
      }
      const destellos: { i: number; j: number; k: number }[] = [];
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
        if (s.gol) destellos.push({ i: s.gx, j: s.gy, k: 1 - d / 3 });
      }
      const intens = new Float32Array(N);
      for (let i = 0; i < N; i++) intens[i] = Math.sqrt(total[i] / escala);

      const giro = -0.4 + 0.26 * Math.sin((ahora - inicio) / 14000);
      px.set(fondo);
      zbuf.fill(1e9);
      for (let v = 0; v < DY; v++) {
        const vv = v / (DY - 1);
        for (let u = 0; u < DX; u++) {
          const uu = u / (DX - 1);
          const h = bil(alto, uu, vv);
          const p = bil(parteA, uu, vv);
          const it = bil(intens, uu, vv);
          /* Luz por la pendiente (de dónde viene la luz: arriba a la izquierda). */
          const hx = bil(alto, Math.min(1, uu + 0.01), vv) - bil(alto, Math.max(0, uu - 0.01), vv);
          const hy = bil(alto, uu, Math.min(1, vv + 0.015)) - bil(alto, uu, Math.max(0, vv - 0.015));
          const ilum = Math.max(0.2, Math.min(1.7, 0.78 - hx * 9 + hy * 6.5 + h * 0.7));
          const q = Math.min(1, Math.max(0, (p - 0.2) / 0.6));
          const espuma = Math.min(1, Math.max(0, (h - 0.42) / 0.35)) * 0.55;
          const vida = Math.min(1.2, 0.34 + Math.pow(it, 0.8) * 1.05);
          const k = ilum * vida;
          const R = Math.min(255, (colA[0] * q + colB[0] * (1 - q)) * k * (1 - espuma) + 255 * espuma);
          const G = Math.min(255, (colA[1] * q + colB[1] * (1 - q)) * k * (1 - espuma) + 255 * espuma);
          const B = Math.min(255, (colA[2] * q + colB[2] * (1 - q)) * k * (1 - espuma) + 255 * espuma);
          const [X, Y, Z] = mundo(uu * (GX - 1), vv * (GY - 1), h);
          const [sx, sy, d] = proyecta(X, Y, Z, giro);
          const x0 = Math.round(sx * dpr);
          const y0 = Math.round(sy * dpr);
          const bruma = Math.min(0.55, Math.max(0, (d + 30) / 110) * 0.55);
          const col = (255 << 24) | (Math.round(B * (1 - bruma) + 40 * bruma) << 16) | (Math.round(G * (1 - bruma) + 26 * bruma) << 8) | Math.round(R * (1 - bruma) + 16 * bruma);
          for (let a2 = 0; a2 < tam; a2++)
            for (let b2 = 0; b2 < tam; b2++) {
              const xx = x0 + a2;
              const yy = y0 + b2;
              if (xx < 0 || yy < 0 || xx >= PW || yy >= PH) continue;
              const o = yy * PW + xx;
              if (d < zbuf[o]) {
                zbuf[o] = d;
                px[o] = col;
              }
            }
        }
      }
      g.putImageData(img, 0, 0);
      /* BRILLO (14/11/2026, «visualmente top»): la imagen en pequeño, desenfocada y sumada
         encima: los puntos y las torres de luz brillan como en el vídeo. */
      if (gg) {
        gg.clearRect(0, 0, brillo.width, brillo.height);
        gg.drawImage(cv, 0, 0, brillo.width, brillo.height);
        g.save();
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = compacto ? 0.25 : 0.32;
        g.filter = `blur(${compacto ? 4 : 9}px)`;
        g.drawImage(brillo, 0, 0, W, H);
        g.restore();
      }

      /* Las líneas del campo, finas y pegadas a la superficie. */
      g.strokeStyle = "rgba(255,255,255,0.45)";
      g.lineWidth = compacto ? 0.5 : 0.9;
      for (const l of lineas) {
        g.beginPath();
        for (let n = 0; n < l.length - 1; n++) {
          const [xa, ya] = l[n];
          const [xb, yb] = l[n + 1];
          const pasos = Math.max(2, Math.ceil(Math.hypot(xb - xa, yb - ya) / 2));
          for (let s = 0; s <= pasos; s++) {
            const x = xa + ((xb - xa) * s) / pasos;
            const y = ya + ((yb - ya) * s) / pasos;
            const [X, Y, Z] = mundo((x / 100) * (GX - 1), (y / 100) * (GY - 1), altoEn(x, y) + 0.012);
            const [sx, sy] = proyecta(X, Y, Z, giro);
            if (n === 0 && s === 0) g.moveTo(sx, sy);
            else g.lineTo(sx, sy);
          }
        }
        g.stroke();
      }
      for (const tiro of r.tiros) {
        const edad = t - tiro.minuto;
        if (edad < 0 || edad > 3) continue;
        const k = 1 - edad / 3;
        const [X, Y, Z] = mundo(tiro.gx, tiro.gy, alto[tiro.gy * GX + tiro.gx]);
        const [sx, sy] = proyecta(X, Y, Z, giro);
        const c = tiro.deA ? colA : colB;
        const altoCol = (compacto ? 50 : 130) * (0.4 + Math.min(1, Math.sqrt(tiro.xg / 0.5)) * 0.6);
        const haz = g.createLinearGradient(sx, sy, sx, sy - altoCol);
        haz.addColorStop(0, css(c, 0.85 * k));
        haz.addColorStop(1, css(c, 0));
        g.fillStyle = haz;
        g.fillRect(sx - (compacto ? 1.5 : 3), sy - altoCol, compacto ? 3 : 6, altoCol);
        g.strokeStyle = css(c, 0.9 * k);
        g.lineWidth = compacto ? 1 : 2;
        g.beginPath();
        g.ellipse(sx, sy, (compacto ? 6 : 14) * (1.6 - k * 0.6), (compacto ? 2.5 : 5) * (1.6 - k * 0.6), 0, 0, Math.PI * 2);
        g.stroke();
      }
      for (const d of destellos) {
        const [X, Y, Z] = mundo(d.i, d.j, alto[d.j * GX + d.i] + 0.15);
        const [sx, sy] = proyecta(X, Y, Z, giro);
        const rad = (compacto ? 16 : 40) * (0.6 + 0.4 * d.k);
        const gr = g.createRadialGradient(sx, sy, 0, sx, sy, rad);
        gr.addColorStop(0, `rgba(255,255,255,${0.95 * d.k})`);
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(sx, sy, rad, 0, Math.PI * 2);
        g.fill();
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
      /* Cada remate que acaba de pasar, aviso. */
      for (const tiro of r.tiros) {
        if (tiro.minuto + 0.5 > anterior && tiro.minuto + 0.5 <= s.t) setAviso({ ...tiro, en: s.t });
      }
      anterior = s.t < anterior ? -1 : s.t;
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
  const nombre = (id: string) => jugadores?.get(id)?.nombre ?? "";
  const parte = minuto <= 45 ? "1.ª PARTE" : "2.ª PARTE";

  if (ev.length < 20) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ background: "#05050a" }}>
      <canvas ref={lienzo} className="block h-auto w-full" style={{ aspectRatio: compacto ? "480 / 270" : "1000 / 560" }} role="img" aria-label={`Retrato 3D del partido ${a.nombre} - ${b.nombre}, animado`} />
      {!compacto && <Momentum curva={r.curva} tiros={r.tiros} minuto={minuto} colA={colA} colB={colB} nombreA={a.nombre} nombreB={b.nombre} />}
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
      {aviso && !compacto && minuto - aviso.minuto < 4 && (
        <div
          key={`${aviso.minuto}-${aviso.jugadorId}`}
          className="pointer-events-none absolute left-1/2 top-[22%] -translate-x-1/2 rounded-2xl px-5 py-3 text-center shadow-2xl"
          style={{
            background: "rgba(10,12,22,0.55)",
            backdropFilter: "blur(10px)",
            border: `1px solid ${css(aviso.deA ? colA : colB, 0.7)}`,
            boxShadow: `0 0 40px ${css(aviso.deA ? colA : colB, 0.35)}`,
            animation: "rmcfAviso 3.2s ease-out forwards",
          }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: css(aviso.deA ? colA : colB) }}>
            {aviso.gol ? "Gol" : aviso.xg >= 0.25 ? "Ocasión clara" : "Ocasión"} · {aviso.minuto}′
          </p>
          <p className={`font-bold ${aviso.gol ? "text-3xl" : "text-lg"}`} style={{ color: "#FFFFFF" }}>
            {nombre(aviso.jugadorId) || (aviso.deA ? a.nombre : b.nombre)}
          </p>
          <p className="text-[11px] tabular-nums" style={{ color: "rgba(255,255,255,0.65)" }}>
            {aviso.deA ? a.nombre : b.nombre} · xG {aviso.xg.toFixed(2).replace(".", ",")}
          </p>
          <style>{`@keyframes rmcfAviso { 0% { opacity: 0; transform: translate(-50%, 8px) scale(.96) } 12% { opacity: 1; transform: translate(-50%, 0) scale(1) } 75% { opacity: 1 } 100% { opacity: 0 } }`}</style>
        </div>
      )}
      {!compacto && (
        <div className="absolute right-3 top-[86px] flex max-w-[60%] flex-wrap items-center justify-end gap-2 sm:right-5">
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
          <span className="flex overflow-hidden rounded-full text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.12)" }}>
            {(["app", "camisetas"] as const).map((m) => (
              <button key={m} type="button" onClick={() => cambiaModo(m)} className="px-2.5 py-1.5" style={modo === m ? { background: "#FFFFFF", color: "#000000" } : { color: "rgba(255,255,255,0.8)" }}>
                {m === "app" ? "Oro y blanco" : "Camisetas"}
              </button>
            ))}
          </span>
          {admin && partido && modo === "camisetas" && (
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

/* EL MOMENTUM (14/11/2026, «debe verse mejor»): una franja propia debajo del 3D. Arriba el
   equipo A, abajo el B, áreas con degradado de su color, el descanso, los goles con bola y
   minuto, y la línea blanca del minuto que corre. Lo ya jugado, encendido; lo que falta, tenue. */
function Momentum({
  curva,
  tiros,
  minuto,
  colA,
  colB,
  nombreA,
  nombreB,
}: {
  curva: number[];
  tiros: { minuto: number; gol: boolean; deA: boolean }[];
  minuto: number;
  colA: RGB;
  colB: RGB;
  nombreA: string;
  nombreB: string;
}) {
  const W = 1000;
  const H = 110;
  const mid = H / 2;
  const fin = curva.length - 1;
  const tope = Math.max(1, ...curva.map(Math.abs));
  const X = (m: number) => 40 + (m / fin) * (W - 60);
  const Y = (v: number) => mid - (v / tope) * (mid - 14);
  const linea = curva.map((v, m) => `${m ? "L" : "M"}${X(m).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const area = `${linea} L${X(fin)},${mid} L${X(0)},${mid} Z`;
  const id = `mom-${Math.round(colA[0])}-${Math.round(colB[0])}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ background: "linear-gradient(180deg, #07080f, #0b0d18)" }} role="img" aria-label="Quién manda minuto a minuto">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={css(colA)} stopOpacity="0.95" />
          <stop offset="0.5" stopColor={css(colA)} stopOpacity="0.15" />
          <stop offset="0.5" stopColor={css(colB)} stopOpacity="0.15" />
          <stop offset="1" stopColor={css(colB)} stopOpacity="0.95" />
        </linearGradient>
        <clipPath id={`${id}-hecho`}>
          <rect x={0} y={0} width={X(Math.min(fin, minuto))} height={H} />
        </clipPath>
      </defs>
      <text x={12} y={18} style={{ fill: css(colA), fontSize: 11, fontWeight: 700 }}>
        {nombreA}
      </text>
      <text x={12} y={H - 8} style={{ fill: css(colB), fontSize: 11, fontWeight: 700 }}>
        {nombreB}
      </text>
      <line x1={X(0)} x2={X(fin)} y1={mid} y2={mid} style={{ stroke: "rgba(255,255,255,0.18)" }} />
      {fin >= 45 && <line x1={X(45)} x2={X(45)} y1={8} y2={H - 8} style={{ stroke: "rgba(255,255,255,0.22)", strokeDasharray: "3 4" }} />}
      {[15, 30, 60, 75, 90].filter((m) => m <= fin).map((m) => (
        <text key={m} x={X(m)} y={mid + 4} textAnchor="middle" style={{ fill: "rgba(255,255,255,0.25)", fontSize: 9 }}>
          {m}′
        </text>
      ))}
      <path d={area} style={{ fill: `url(#${id}-a)`, opacity: 0.25 }} />
      <g clipPath={`url(#${id}-hecho)`}>
        <path d={area} style={{ fill: `url(#${id}-a)` }} />
        <path d={linea} style={{ fill: "none", stroke: "rgba(255,255,255,0.75)", strokeWidth: 1.4 }} />
      </g>
      {tiros
        .filter((t) => t.gol)
        .map((t, i) => (
          <g key={i} style={{ opacity: t.minuto <= minuto ? 1 : 0.3 }}>
            <circle cx={X(t.minuto)} cy={t.deA ? 12 : H - 12} r={6} style={{ fill: "#FFFFFF", stroke: css(t.deA ? colA : colB), strokeWidth: 3 }} />
            <text x={X(t.minuto) + 10} y={t.deA ? 16 : H - 8} style={{ fill: "#FFFFFF", fontSize: 10, fontWeight: 700 }}>
              {t.minuto}′
            </text>
          </g>
        ))}
      <line x1={X(Math.min(fin, minuto))} x2={X(Math.min(fin, minuto))} y1={4} y2={H - 4} style={{ stroke: "#FFFFFF", strokeWidth: 2 }} />
    </svg>
  );
}
