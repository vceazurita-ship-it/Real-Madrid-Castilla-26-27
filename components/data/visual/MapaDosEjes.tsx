"use client";

/*
| MAPA DE DOS EJES (05/11/2026)
|
| Cada eje es un percentil 0-100 dentro de su grupo (su puesto, o la liga en
| el caso de equipos). Las diagonales suman los dos (100, 130, 160) y la
| esquina de arriba a la derecha (≥ 160) es la élite en las dos cosas. Las
| esquinas llevan nombre: «completos», «solo X», «solo Y» y «sin destacar
| todavía». Idea de @AlexDeLlano y The Eye Intelligence Unit.
|
| - Lo nuestro se ve siempre: punto grande, anillo y rótulo, y sus cifras en
|   texto debajo (en el móvil no hay ratón).
| - De los demás se rotulan sólo los que dicen algo (élite y mejor en cada
|   eje), y ninguno que pise a otro rótulo o a los nombres de las esquinas.
| - En pantallas estrechas el lienzo es más bajo y estrecho, así la letra no
|   baja de 9 px reales.
*/

import { useEffect, useRef, useState } from "react";

export type PuntoMapa = {
  id: string;
  nombre: string;
  /** Percentil 0-100. */
  x: number;
  y: number;
  /** El nuestro (o los nuestros): siempre a la vista. */
  propio?: boolean;
  detalle?: string;
  color?: string;
  /** Con menos muestra que los demás (menos partidos): punto hueco. */
  hueco?: boolean;
};

type Caja = { x0: number; x1: number; y0: number; y1: number };
const choca = (a: Caja, cajas: Caja[]) => cajas.some((c) => c.x0 < a.x1 && a.x0 < c.x1 && c.y0 < a.y1 && a.y0 < c.y1);

export function MapaDosEjes({
  puntos,
  ejeX,
  ejeY,
  rotulos,
  acento = "#D8B45A",
  umbral = 160,
  detallePropios = true,
}: {
  puntos: PuntoMapa[];
  ejeX: string;
  ejeY: string;
  /** `nadaCorto`: el de la esquina de abajo en el móvil (recortar a dos palabras dejaba «NI UNA»). */
  rotulos: { ambos: string; soloX: string; soloY: string; nada: string; nadaCorto?: string };
  acento?: string;
  umbral?: number;
  /** Las cifras de lo nuestro en texto bajo el mapa (la ficha); el panel de equipo ya las da en su lectura. */
  detallePropios?: boolean;
}) {
  const [encima, setEncima] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(760);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (puntos.length < 5) return null;

  const estrecho = ancho < 560;
  const W = estrecho ? 430 : 760;
  const H = estrecho ? 470 : 560;
  /* En estrecho los rótulos de las esquinas van en dos alturas: en una se pisaban. */
  const M = { l: 46, r: 16, t: estrecho ? 56 : 40, b: 46 };
  const anchoP = W - M.l - M.r;
  const altoP = H - M.t - M.b;
  const px = (v: number) => M.l + (v / 100) * anchoP;
  const py = (v: number) => M.t + altoP - (v / 100) * altoP;
  const letra = estrecho ? 13 : 12;

  const elite = puntos.filter((p) => p.x + p.y >= umbral);
  const mejorAmbos = [...puntos].sort((a, b) => b.x + b.y - (a.x + a.y))[0];
  /* «Puro»: el que más destaca en un eje sin el otro. */
  const mejorX = [...puntos].sort((a, b) => b.x - b.y - (a.x - a.y))[0];
  const mejorY = [...puntos].sort((a, b) => b.y - b.x - (a.y - a.x))[0];
  const candidatos = new Set([...(estrecho ? [] : elite.map((p) => p.id)), mejorX.id, mejorY.id, mejorAmbos.id, ...puntos.filter((p) => p.propio).map((p) => p.id)]);

  /* Los nombres de las esquinas, como cajas ocupadas desde el principio. */
  const esquinas = [
    { texto: `↑ ${rotulos.soloY.toUpperCase()}`, x: px(0), y: estrecho ? M.t - 32 : M.t - 14, fin: false, color: undefined, peso: 700, t: estrecho ? letra - 2 : letra },
    { texto: rotulos.soloX.toUpperCase(), x: px(99), y: estrecho ? py(3) - 16 : py(3), fin: true, color: undefined, peso: 700, t: estrecho ? letra - 2 : letra },
    { texto: (estrecho ? rotulos.nadaCorto ?? rotulos.nada.split(" ").slice(0, 2).join(" ") : rotulos.nada).toUpperCase(), x: px(2), y: estrecho ? py(6) - 12 : py(6), fin: false, color: undefined, peso: 700, t: estrecho ? letra - 2 : letra },
  ];
  const ocupadas: Caja[] = esquinas.map((e) => {
    const w = e.texto.length * e.t * 0.68;
    return { x0: e.fin ? e.x - w : e.x, x1: e.fin ? e.x : e.x + w, y0: e.y - e.t, y1: e.y + 3 };
  });

  for (const p of puntos) ocupadas.push({ x0: px(p.x) - 6, x1: px(p.x) + 6, y0: py(p.y) - 6, y1: py(p.y) + 6 });
  /* La línea de la zona, a trozos: un rótulo encima no se lee. */
  for (let v = Math.max(0, umbral - 100); v <= 100; v += 4) ocupadas.push({ x0: px(v) - 2, x1: px(v) + 2, y0: py(umbral - v) - 2, y1: py(umbral - v) + 2 });

  /* Rótulos: lo nuestro primero (prueba ocho sitios), luego el resto si cabe. */
  const rotulo = new Map<string, { x: number; y: number; fin: boolean }>();
  const prioridad = [...puntos].sort((a, b) => Number(Boolean(b.propio)) - Number(Boolean(a.propio)) || b.x + b.y - (a.x + a.y));
  for (const p of prioridad) {
    if (!candidatos.has(p.id) && encima !== p.id) continue;
    const t = p.propio ? letra + 3 : letra;
    const w = p.nombre.length * t * (p.propio ? 0.64 : 0.6);
    const cx = px(p.x);
    const cy = py(p.y);
    const sitios = [
      { x: cx + 11, y: cy - 9, fin: false },
      { x: cx - 11, y: cy - 9, fin: true },
      { x: cx + 11, y: cy + t + 6, fin: false },
      { x: cx - 11, y: cy + t + 6, fin: true },
      { x: cx + 14, y: cy - 22, fin: false },
      { x: cx - 14, y: cy - 22, fin: true },
      { x: cx + 14, y: cy + t + 18, fin: false },
      { x: cx - 14, y: cy + t + 18, fin: true },
      { x: cx - 14, y: cy + t + 32, fin: true },
      { x: cx + 14, y: cy + t + 32, fin: false },
    ].filter((s) => (s.fin ? s.x - w > 2 : s.x + w < W - 2));
    let puesto = false;
    for (const s of sitios) {
      const c: Caja = { x0: s.fin ? s.x - w : s.x, x1: s.fin ? s.x : s.x + w, y0: s.y - t, y1: s.y + 3 };
      /* El propio punto no cuenta como obstáculo de su rótulo. */
      const propioPunto = (o: Caja) => o.x0 === px(p.x) - 6 && o.y0 === py(p.y) - 6;
      if (!choca(c, ocupadas.filter((o) => !propioPunto(o)))) {
        ocupadas.push(c);
        rotulo.set(p.id, s);
        puesto = true;
        break;
      }
    }
    /* Lo nuestro sale aunque no quepa limpio: en el sitio que menos pisa. */
    if (!puesto && (p.propio || encima === p.id) && sitios.length) {
      const pisa = (s: (typeof sitios)[number]) => {
        const c: Caja = { x0: s.fin ? s.x - w : s.x, x1: s.fin ? s.x : s.x + w, y0: s.y - t, y1: s.y + 3 };
        return ocupadas.reduce((n, o) => n + Math.max(0, Math.min(c.x1, o.x1) - Math.max(c.x0, o.x0)) * Math.max(0, Math.min(c.y1, o.y1) - Math.max(c.y0, o.y0)), 0);
      };
      const mejor = [...sitios].sort((a, b) => pisa(a) - pisa(b))[0];
      rotulo.set(p.id, mejor);
      ocupadas.push({ x0: mejor.fin ? mejor.x - w : mejor.x, x1: mejor.fin ? mejor.x : mejor.x + w, y0: mejor.y - t, y1: mejor.y + 3 });
    }
  }

  const diagonal = (s: number) => ({ x1: px(Math.max(0, s - 100)), y1: py(Math.min(100, s)), x2: px(Math.min(100, s)), y2: py(Math.max(0, s - 100)) });
  const ordenados = [...puntos].sort((a, b) => Number(Boolean(a.propio)) - Number(Boolean(b.propio)));
  const activo = puntos.find((p) => p.id === encima);
  const propios = puntos.filter((p) => p.propio);

  return (
    <div ref={caja} className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto w-full max-w-[860px]" role="img" aria-label={`${ejeY} frente a ${ejeX}`} onMouseLeave={() => setEncima(null)}>
        <polygon points={`${px(umbral - 100)},${py(100)} ${px(100)},${py(100)} ${px(100)},${py(umbral - 100)}`} fill={acento} fillOpacity={0.14} />
        <line {...diagonal(umbral)} stroke={acento} strokeWidth={2} />

        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={px(v)} x2={px(v)} y1={py(0)} y2={py(100)} stroke="currentColor" strokeOpacity={v === 50 ? 0.22 : 0.08} />
            <line x1={px(0)} x2={px(100)} y1={py(v)} y2={py(v)} stroke="currentColor" strokeOpacity={v === 50 ? 0.22 : 0.08} />
            <text x={px(v)} y={py(0) + 16} textAnchor="middle" fontSize={letra - 1} fill="currentColor" fillOpacity={0.5}>{v}</text>
            <text x={px(0) - 6} y={py(v) + 4} textAnchor="end" fontSize={letra - 1} fill="currentColor" fillOpacity={0.5}>{v}</text>
          </g>
        ))}

        {[100, 130].map((s) => (
          <line key={s} {...diagonal(s)} stroke="currentColor" strokeOpacity={0.22} strokeDasharray="5 5" />
        ))}

        {esquinas.map((e) => (
          <text key={e.texto} x={e.x} y={e.y} textAnchor={e.fin ? "end" : "start"} fontSize={e.t} fontWeight={e.peso} letterSpacing={estrecho ? "0.03em" : "0.12em"} fill={e.color ?? "currentColor"} fillOpacity={e.color ? 1 : 0.5}>
            {e.texto}
          </text>
        ))}

        {ordenados.map((p, i) => {
          const propio = Boolean(p.propio);
          const color = p.color ?? (propio ? acento : "currentColor");
          const r = rotulo.get(p.id);
          return (
            <g key={p.id} className="md-punto" style={{ animationDelay: `${Math.min(i, 60) * 12}ms` }} onMouseEnter={() => setEncima(p.id)} onClick={() => setEncima(p.id)}>
              {/* El pulso, animando el radio (07/11/2026): con transform: scale el navegador lo escalaba como imagen y se veía pixelado. */}
              {propio && (
                <circle cx={px(p.x)} cy={py(p.y)} r={9} fill="none" stroke={color} strokeWidth={2}>
                  <animate attributeName="r" values="9;25" dur="2.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0" dur="2.2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={px(p.x)} cy={py(p.y)} r={propio ? 7.5 : estrecho ? 5 : 4.2} fill={p.hueco ? "none" : color} fillOpacity={propio ? 1 : r ? 0.85 : 0.35} stroke={propio ? "#fff" : p.hueco ? "currentColor" : "none"} strokeOpacity={p.hueco ? 0.6 : 1} strokeWidth={1.5}>
                <title>{`${p.nombre}${p.detalle ? ` · ${p.detalle}` : ""} · ${ejeX} ${Math.round(p.x)} · ${ejeY} ${Math.round(p.y)}`}</title>
              </circle>
              {/* Zona de toque más grande que el punto, para el dedo. */}
              <circle cx={px(p.x)} cy={py(p.y)} r={12} fill="transparent" />
              {r && (Math.abs(r.y - py(p.y)) > 16 || Math.abs(r.x - px(p.x)) > 13) && (
                <line x1={px(p.x)} y1={py(p.y)} x2={r.x} y2={r.y - 4} stroke="currentColor" strokeOpacity={0.35} />
              )}
              {r && (
                <text className="md-rotulo" x={r.x} y={r.y} textAnchor={r.fin ? "end" : "start"} fontSize={propio ? letra + 3 : letra} fontWeight={propio ? 800 : 600} fill={propio ? color : "currentColor"} fillOpacity={propio ? 1 : 0.85}>
                  {p.nombre}
                </text>
              )}
            </g>
          );
        })}

        <text x={px(50)} y={H - 8} textAnchor="middle" fontSize={letra} fontWeight="700" letterSpacing="0.1em" fill="currentColor" fillOpacity={0.75}>{`${ejeX.toUpperCase()} · PERCENTIL`}</text>
        <text x={13} y={py(50)} textAnchor="middle" fontSize={letra} fontWeight="700" letterSpacing="0.1em" fill="currentColor" fillOpacity={0.75} transform={`rotate(-90 13 ${py(50)})`}>{`${ejeY.toUpperCase()} · PERCENTIL`}</text>
      </svg>

      {/* Lo nuestro en texto: en el móvil no se puede pasar el ratón. */}
      {detallePropios && propios.map((p) => (
        <p key={p.id} className="text-[13px] text-white/80">
          <span className="mr-1" style={{ color: p.color ?? acento }}>●</span>
          <b>{p.nombre}</b>: {ejeX.toLowerCase()} {Math.round(p.x)} · {ejeY.toLowerCase()} {Math.round(p.y)}
          {p.x + p.y >= umbral ? ` · en la zona de ${rotulos.ambos.toLowerCase()}` : ""}
          {p.detalle ? <span className="text-white/55"> · {p.detalle}</span> : null}
        </p>
      ))}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/60">
        <span><span style={{ color: acento }}>◥</span> Zona sombreada: <b style={{ color: acento }}>{rotulos.ambos.toLowerCase()}</b> (suma ≥ {umbral})</span>
        <span><b style={{ color: acento }}>Mejor en ambas:</b> {mejorAmbos.nombre} ({Math.round(mejorAmbos.x)} / {Math.round(mejorAmbos.y)})</span>
        <span><b className="text-white/80">Más «{rotulos.soloX.toLowerCase()}»:</b> {mejorX.nombre}</span>
        <span><b className="text-white/80">Más «{rotulos.soloY.toLowerCase()}»:</b> {mejorY.nombre}</span>
        <span>{elite.length} de {puntos.length} en la zona de {rotulos.ambos.toLowerCase()} (suma ≥ {umbral})</span>
        <span className="text-white/45">Más es mejor en los dos ejes · toca o pasa por un punto para ver quién es{puntos.some((p) => p.hueco) ? " · punto hueco: menos partidos que el resto" : ""}.</span>
      </div>
      {activo && !activo.propio && <p className="text-[12px] text-white/75">{activo.nombre}{activo.detalle ? ` · ${activo.detalle}` : ""} · {Math.round(activo.x)} / {Math.round(activo.y)}</p>}

      <style>{`.md-punto{animation:md-entra .5s ease-out both;cursor:pointer}.md-rotulo{paint-order:stroke;stroke:var(--background);stroke-width:2.5px;stroke-linejoin:round;text-rendering:geometricPrecision}@keyframes md-entra{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
}
