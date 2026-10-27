"use client";

/**
 * EL DIBUJO DE LA PIZARRA DEL LABORATORIO (24/10/2026).
 *
 * Un solo SVG que pinta la jugada en el instante `t` con la cámara que toque
 * (`lib/abp-lab/camara.ts`): césped con franjas y luz, portería con red,
 * sombras, el balón a su altura con su sombra en el suelo, carreras,
 * bloqueos, la defensa simulada y, encima, las lecturas (espacio, duelos
 * aéreos, xG del remate).
 *
 * No guarda estado ni sabe editar: la pizarra (`PizarraRutina`) le pasa los
 * manejadores. Todo el color va en `style` y con valores fijos de su paleta
 * —la de día o la de noche, según el tema—, para que el PNG, el PDF, el
 * vídeo y el GIF salgan como se ven.
 */

import { useSyncExternalStore, type PointerEvent as PE, type KeyboardEvent as KE, type Ref } from "react";

import { iniciales, type JugadorLab } from "@/components/abp-lab/comun";
import { AREA, AREA_PEQUENA, PENALTI, PORTERIA, ANCHO, LARGO, VUELO, posicionesEn, recorridoBalon, salidas, tramoDe } from "@/lib/abp-lab/campo";
import { curva, linea, poligono, type Camara, type P3 } from "@/lib/abp-lab/camara";
import type { Envio, Fase, Lado, Papel, Punto, Rol } from "@/lib/abp-lab/modelo";
import type { TipoAbp } from "@/lib/abp-lab/referentes";
import { estadoBalon, type Defensor, type EstadoDefensa } from "@/lib/abp-lab/simulacion";
import type { Celda, Duelo, Remate } from "@/lib/abp-lab/ventaja";
import { comaXg } from "@/lib/abp-lab/xg";

/* ------------------------------------------------------------------ */
/*  PALETAS                                                            */
/* ------------------------------------------------------------------ */

export type Paleta = {
  nombre: "dia" | "noche";
  cielo: string;
  grada: string;
  cesped: string;
  franja: string;
  orilla: string;
  linea: string;
  red: string;
  luz: string;
  vineta: string;
  sombra: string;
  oro: string;
  tinta: string;
  rival: string;
  rivalTexto: string;
  portero: string;
  balon: string;
  texto: string;
  halo: string;
  fase: Record<Fase, string>;
  nuestro: string;
  suyo: string;
  bloqueo: string;
  /** El césped pisado de la boca de gol. */
  gastado: string;
  /** De dónde viene la luz: hacia dónde cae cada sombra (en metros por metro de alto) y cuánto pesa. De día, el sol; de noche, las torres. */
  luces: { dx: number; dy: number; a: number }[];
  /** Las vallas de publicidad y la grada, en las cámaras de televisión. */
  valla: string;
  publico: string;
};

export const NOCHE: Paleta = {
  nombre: "noche",
  cielo: "#03070B",
  grada: "#0B141C",
  cesped: "#0E3A26",
  franja: "#114631",
  orilla: "#0B3020",
  linea: "rgba(255,255,255,0.8)",
  red: "rgba(255,255,255,0.34)",
  luz: "rgba(255,247,222,0.17)",
  vineta: "rgba(0,0,0,0.62)",
  sombra: "rgba(0,0,0,0.5)",
  oro: "#C8A96B",
  tinta: "#0B0F14",
  rival: "#A3203A",
  rivalTexto: "#FFFFFF",
  portero: "#E8B931",
  balon: "#FFFFFF",
  texto: "#FFFFFF",
  halo: "rgba(0,0,0,0.7)",
  fase: { 1: "#7DD3FC", 2: "#E7C98A", 3: "#86EFAC" },
  nuestro: "200,169,107",
  suyo: "232,64,92",
  bloqueo: "#FF9F43",
  gastado: "rgba(150,140,100,0.1)",
  luces: [
    { dx: -0.42, dy: 0.38, a: 0.55 },
    { dx: 0.42, dy: 0.38, a: 0.55 },
    { dx: 0.05, dy: -0.5, a: 0.35 },
  ],
  valla: "#0A1118",
  publico: "#070D13",
};

export const DIA: Paleta = {
  nombre: "dia",
  cielo: "#C7D2CC",
  grada: "#9FB0A8",
  cesped: "#3C8A4E",
  franja: "#459858",
  orilla: "#357C46",
  linea: "rgba(255,255,255,0.95)",
  red: "rgba(255,255,255,0.55)",
  luz: "rgba(255,252,228,0.22)",
  vineta: "rgba(18,40,26,0.26)",
  sombra: "rgba(8,30,16,0.36)",
  oro: "#C8A96B",
  tinta: "#0B0F14",
  rival: "#9B1C31",
  rivalTexto: "#FFFFFF",
  portero: "#E8B931",
  balon: "#FFFFFF",
  texto: "#FFFFFF",
  halo: "rgba(6,20,12,0.78)",
  fase: { 1: "#0EA5E9", 2: "#FDE68A", 3: "#BBF7D0" },
  nuestro: "253,224,140",
  suyo: "190,24,60",
  bloqueo: "#FB923C",
  gastado: "rgba(214,196,136,0.22)",
  luces: [{ dx: 0.55, dy: 0.42, a: 1 }],
  valla: "#1D2A33",
  publico: "#6E8079",
};

const suscribeTema = (aviso: () => void) => {
  const observador = new MutationObserver(aviso);

  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  return () => observador.disconnect();
};

/** La paleta del tablero según el tema de la app: de día, partido a pleno sol; de noche, con focos. */
export function usePaleta(): Paleta {
  const tema = useSyncExternalStore(
    suscribeTema,
    () => document.documentElement.getAttribute("data-theme"),
    () => "light",
  );

  return tema === "dark" ? NOCHE : DIA;
}

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

export const CODIGO_PAPEL: Record<Papel, string> = {
  lanzador: "L",
  rematador: "R",
  bloqueador: "B",
  senuelo: "S",
  portero: "P",
  corto: "C",
  segunda: "2ª",
  vigilancia: "V",
  zonal: "Z",
  marcador: "H",
};

/* Los papeles que no pisan el remate se pintan huecos. */
const HUECO: Partial<Record<Papel, boolean>> = { senuelo: true, segunda: true, vigilancia: true };

const nombreCorto = (n: string) => {
  const partes = n.trim().split(/\s+/);

  return partes.length > 1 && partes[0].length <= 3 ? partes.slice(0, 2).join(" ") : (partes[0] ?? n);
};

const FUENTE = "Barlow Condensed, Arial Narrow, Arial, sans-serif";

const f3 = (v: number) => Number(v.toFixed(3));

/** El color del protagonista en los vídeos por jugador (el rosa del PDF por jugador). */
const ROSA = "#FF4FA3";

export type RutinaEscena = {
  nombre: string;
  tipo: TipoAbp;
  roles: Rol[];
  balon?: Punto[];
  envio?: Envio;
  /** A favor o en contra: cambia el rótulo del rival que le toca al protagonista. */
  lado?: Lado;
};

export type Capas = {
  nombres: boolean;
  fotos: boolean;
  ventaja: boolean;
  duelos: boolean;
  /** El mapa de calor de llegada (`mapaLlegada`). */
  llegada?: boolean;
};

export type ManejadoresEscena = {
  onFondo?: (e: PE<SVGSVGElement>) => void;
  onMueve?: (e: PE<SVGSVGElement>) => void;
  onSuelta?: (e: PE<SVGSVGElement>) => void;
  onFicha?: (e: PE<SVGGElement>, i: number) => void;
  onTeclaFicha?: (e: KE<SVGGElement>, i: number) => void;
  onFocoFicha?: (i: number) => void;
  onPuntoBalon?: (e: PE<SVGGElement>, i: number) => void;
  onQuitaPunto?: (i: number) => void;
  etiquetaFicha?: (i: number) => string;
};

export function Escena({
  id,
  rutina,
  porId,
  t,
  cam,
  paleta: P,
  nuestros,
  defensa,
  capas,
  celdas,
  libres,
  duelos,
  llegada,
  remate,
  seleccionado = null,
  destacado = null,
  editaBalon = false,
  fotos,
  svgRef,
  manejadores = {},
  cursor,
  etiqueta,
  className = "",
  quieta = false,
}: {
  id: string;
  rutina: RutinaEscena;
  porId: Map<string, JugadorLab>;
  t: number;
  cam: Camara;
  paleta: Paleta;
  /** Dónde está cada uno de los nuestros en `t`. */
  nuestros: Punto[];
  defensa: { plan: Defensor[]; estado: EstadoDefensa } | null;
  capas: Capas;
  celdas?: Celda[];
  libres?: Punto[];
  duelos?: Duelo[];
  /** El mapa de calor de llegada, si se pinta. */
  llegada?: Celda[];
  remate?: Remate | null;
  seleccionado?: number | null;
  /** El vídeo de un jugador: él con su aro y «TÚ»; los demás nuestros, apagados. */
  destacado?: number | null;
  editaBalon?: boolean;
  /** Las fotos ya leídas como `data:` (para que salgan al exportar); si falta, se usa la URL. */
  fotos?: Map<string, string>;
  svgRef?: Ref<SVGSVGElement>;
  manejadores?: ManejadoresEscena;
  cursor?: string;
  etiqueta: string;
  className?: string;
  /** Miniatura: sin lecturas ni rótulos. */
  quieta?: boolean;
}) {
  const { caja } = cam;

  /* Una unidad de pantalla fija para rótulos y grosores que no dependen de la distancia. */
  const u = caja.w / 52;

  /* El césped llega hasta pasado el medio campo (o hasta donde la cámara deja ver sin pasar por detrás). */
  const fondo = Math.min(LARGO + 18, cam.yMax);

  const desde = salidas(rutina.roles);

  const camino = recorridoBalon(rutina);

  const envio = rutina.envio ?? "tenso";

  const balon = estadoBalon(camino, t, envio, rutina.tipo);

  const M = manejadores;

  /* ------------------------------ el campo ----------------------------- */

  const g = (p: P3) => cam.proy(p);

  const franjas = Array.from({ length: Math.ceil(fondo / 5.5) }, (_, i) => i);

  const dxArco = Math.sqrt(9.15 ** 2 - (AREA.y - PENALTI.y) ** 2);

  const anchoLinea = cam.tresD ? 0.13 * cam.escala : 0.14;

  const estiloLinea = { fill: "none", stroke: P.linea, strokeWidth: anchoLinea, strokeLinecap: "round" as const };

  /* La portería en tres dimensiones: palos, larguero y la red hacia atrás. */
  const alto = 2.44;

  const atras = -1.9;

  const redes = [
    poligono(cam, [
      { x: PORTERIA.x0, y: 0, z: alto },
      { x: PORTERIA.x1, y: 0, z: alto },
      { x: PORTERIA.x1, y: atras, z: alto * 0.75 },
      { x: PORTERIA.x0, y: atras, z: alto * 0.75 },
    ]),
    poligono(cam, [
      { x: PORTERIA.x0, y: atras, z: 0 },
      { x: PORTERIA.x1, y: atras, z: 0 },
      { x: PORTERIA.x1, y: atras, z: alto * 0.75 },
      { x: PORTERIA.x0, y: atras, z: alto * 0.75 },
    ]),
  ];

  const mallas = [
    ...Array.from({ length: 9 }, (_, i) => {
      const x = PORTERIA.x0 + ((PORTERIA.x1 - PORTERIA.x0) * (i + 1)) / 10;

      return linea(cam, { x, y: 0, z: alto }, { x, y: atras, z: alto * 0.75 }) + " " + linea(cam, { x, y: atras, z: alto * 0.75 }, { x, y: atras, z: 0 });
    }),
    ...Array.from({ length: 3 }, (_, i) => {
      const z = (alto * 0.75 * (i + 1)) / 4;

      return linea(cam, { x: PORTERIA.x0, y: atras, z }, { x: PORTERIA.x1, y: atras, z });
    }),
  ];

  const palos = [
    linea(cam, { x: PORTERIA.x0, y: 0, z: 0 }, { x: PORTERIA.x0, y: 0, z: alto }),
    linea(cam, { x: PORTERIA.x1, y: 0, z: 0 }, { x: PORTERIA.x1, y: 0, z: alto }),
    linea(cam, { x: PORTERIA.x0, y: 0, z: alto }, { x: PORTERIA.x1, y: 0, z: alto }),
  ];

  /* ---------------------------- las fichas ----------------------------- */

  /* La altura a la que se miden los duelos: la cabeza en perspectiva. */
  const levanta = cam.tresD ? 1.7 : 0;

  type Pieza =
    | { tipo: "nuestro"; i: number; p: Punto; prof: number }
    | { tipo: "suyo"; k: number; p: Punto; prof: number }
    | { tipo: "balon"; prof: number };

  /* Con la cámara baja, lo que queda a la espalda del ojo no se pinta. */
  const seVe = (p: Punto) => p.y < cam.yMax - 1;

  const piezas: Pieza[] = [
    ...rutina.roles.map((_, i) => ({ tipo: "nuestro" as const, i, p: nuestros[i], prof: g({ ...nuestros[i], z: 0 }).s })),
    ...(defensa ? defensa.plan.map((_, k) => ({ tipo: "suyo" as const, k, p: defensa.estado.pos[k], prof: g({ ...defensa.estado.pos[k], z: 0 }).s })) : []),
    { tipo: "balon" as const, prof: g({ ...balon.suelo, z: 0 }).s + (cam.tresD ? 0 : 1000) },
  ].filter((p) => p.tipo === "balon" || seVe(p.p));

  /* De lejos a cerca (en cenital, de arriba abajo): lo de delante tapa a lo de detrás. */
  piezas.sort((a, b) => (cam.tresD ? a.prof - b.prof : (a.tipo === "balon" ? 1e9 : a.p.y) - (b.tipo === "balon" ? 1e9 : b.p.y)));

  /* El protagonista del vídeo va encima de todo: que nadie le tape. */
  if (destacado !== null) {
    const suyo = piezas.findIndex((p) => p.tipo === "nuestro" && p.i === destacado);

    if (suyo >= 0) piezas.push(...piezas.splice(suyo, 1));
  }

  /* Los demás nuestros, en segundo plano cuando hay protagonista. */
  const apagado = (i: number) => destacado !== null && i !== destacado;

  /* En cenital, la ficha mide 1,2 m; en perspectiva, lo que mide a esa distancia, sin bajar de lo legible ni tapar media pantalla. */
  const radioFicha = (s: number) => (cam.tresD ? Math.min(Math.max(0.78 * s, u * 0.62), u * 2.1) : 1.2);

  /* Unidades de pantalla por metro de un jugador en perspectiva, con los mismos topes. */
  const metroDe = (s: number) => Math.min(Math.max(s, u * 1.02), u * 2.8);

  const textoFicha = (r: Rol, j?: JugadorLab) => (j ? String(j.dorsal ?? iniciales(j.nombre)) : CODIGO_PAPEL[r.papel]);

  const fotoDe = (j?: JugadorLab) => (capas.fotos && j?.foto ? (fotos?.get(j.foto) ?? j.foto) : null);

  /** Una elipse tumbada en el césped, en metros (se deforma con la perspectiva como la de verdad). */
  const elipseSuelo = (c: Punto, a: number, b: number, giro = 0, pasos = 16) => {
    const cs = Math.cos(giro);
    const sn = Math.sin(giro);

    return curva(cam, (v) => {
      const ang = v * Math.PI * 2;

      const x = a * Math.cos(ang);
      const y = b * Math.sin(ang);

      return { x: c.x + x * cs - y * sn, y: c.y + x * sn + y * cs, z: 0 };
    }, pasos).concat(" Z");
  };

  /** Las sombras de un jugador: una por cada luz (el sol de día, las torres de noche), alargadas hacia donde caen. */
  const sombras = (p: Punto, alto: number, ancho: number, clave: string) =>
    P.luces.map((l, n) => {
      const largo = Math.hypot(l.dx, l.dy) * alto;

      const giro = Math.atan2(l.dy, l.dx);

      const centro = { x: p.x + l.dx * alto * 0.5, y: p.y + l.dy * alto * 0.5 };

      return <path key={`${clave}-${n}`} d={elipseSuelo(centro, Math.max(ancho, largo * 0.55), ancho, giro, 14)} style={{ fill: P.sombra, opacity: l.a }} />;
    });

  const rotulo = (x: number, y: number, texto: string, tam: number, color = P.texto, peso = 700) => (
    <text x={f3(x)} y={f3(y)} textAnchor="middle" style={{ fontSize: f3(tam), fontWeight: peso, fill: color, fontFamily: FUENTE, paintOrder: "stroke", stroke: P.halo, strokeWidth: f3(tam * 0.18), strokeLinejoin: "round", letterSpacing: f3(tam * 0.01) }}>
      {texto}
    </text>
  );

  /** Un aro en el césped, como el que pinta la realización alrededor del protagonista. */
  const aroSuelo = (p: Punto, r: number, color: string, discontinuo: boolean, grosor = 0.12) => {
    const w = cam.tresD ? grosor * Math.max(g({ ...p, z: 0 }).s, u * 0.5) : grosor;

    return <path d={elipseSuelo(p, r, r, 0, 28)} style={{ fill: "none", stroke: color, strokeWidth: f3(w), strokeDasharray: discontinuo ? `${f3(w * 3)} ${f3(w * 2)}` : undefined, opacity: 0.95 }} />;
  };

  /** El «TÚ» del vídeo de un jugador: una placa rosa encima de él, legible en el móvil. */
  const etiquetaTu = (x: number, y: number, tam: number, texto = "TÚ") => (
    <g style={{ pointerEvents: "none" }}>
      <rect x={f3(x - tam * (0.35 + texto.length * 0.3))} y={f3(y - tam * 1.05)} width={f3(tam * (0.7 + texto.length * 0.6))} height={f3(tam * 1.2)} rx={f3(tam * 0.3)} style={{ fill: ROSA, stroke: "#FFFFFF", strokeWidth: f3(tam * 0.08) }} />
      <text x={f3(x)} y={f3(y - tam * 0.12)} textAnchor="middle" style={{ fontSize: f3(tam * 0.88), fontWeight: 800, fill: "#FFFFFF", fontFamily: FUENTE, letterSpacing: f3(tam * 0.04) }}>
        {texto}
      </text>
    </g>
  );

  /**
   * Un jugador de pie, en perspectiva: medias, pantalón, camiseta con su
   * dorsal a la espalda (la cámara mira desde detrás de los atacantes),
   * brazos y cabeza, con luz de un lado y sombra del otro.
   */
  const figura = (p: Punto, ropa: { camiseta: string; pantalon: string; medias: string; dorsal: string | null; tinta: string }, opacidad: number) => {
    const pie = g({ ...p, z: 0 });

    const m = metroDe(pie.s);

    const X = (dx: number) => f3(pie.x + dx * m);
    const Y = (z: number) => f3(pie.y - z * m);

    const contorno = { stroke: "rgba(0,0,0,0.38)", strokeWidth: f3(0.025 * m), strokeLinejoin: "round" as const };

    const torso = `M ${X(-0.17)} ${Y(0.9)} L ${X(-0.25)} ${Y(1.4)} Q ${X(-0.24)} ${Y(1.5)} ${X(-0.12)} ${Y(1.5)} L ${X(0.12)} ${Y(1.5)} Q ${X(0.24)} ${Y(1.5)} ${X(0.25)} ${Y(1.4)} L ${X(0.17)} ${Y(0.9)} Z`;

    const shorts = `M ${X(-0.18)} ${Y(0.94)} L ${X(0.18)} ${Y(0.94)} L ${X(0.2)} ${Y(0.66)} L ${X(0.02)} ${Y(0.66)} L ${X(0)} ${Y(0.78)} L ${X(-0.02)} ${Y(0.66)} L ${X(-0.2)} ${Y(0.66)} Z`;

    return (
      <g style={{ opacity: opacidad }}>
        {/* Piernas: muslo y media */}
        {[-1, 1].map((l) => (
          <g key={l}>
            <path d={`M ${X(l * 0.1)} ${Y(0.68)} L ${X(l * 0.11)} ${Y(0.42)}`} style={{ stroke: "#B9855F", strokeWidth: f3(0.12 * m), strokeLinecap: "round" }} />
            <path d={`M ${X(l * 0.11)} ${Y(0.44)} L ${X(l * 0.12)} ${Y(0.05)}`} style={{ stroke: ropa.medias, strokeWidth: f3(0.12 * m), strokeLinecap: "round" }} />
            <path d={`M ${X(l * 0.12)} ${Y(0.04)} L ${X(l * 0.12 + 0.06)} ${Y(0.02)}`} style={{ stroke: "#111", strokeWidth: f3(0.1 * m), strokeLinecap: "round" }} />
          </g>
        ))}
        <path d={shorts} style={{ fill: ropa.pantalon, ...contorno }} />
        {/* Brazos */}
        {[-1, 1].map((l) => (
          <g key={`b${l}`}>
            <path d={`M ${X(l * 0.23)} ${Y(1.42)} L ${X(l * 0.3)} ${Y(1.16)}`} style={{ stroke: ropa.camiseta, strokeWidth: f3(0.13 * m), strokeLinecap: "round" }} />
            <path d={`M ${X(l * 0.3)} ${Y(1.16)} L ${X(l * 0.32)} ${Y(0.92)}`} style={{ stroke: "#B9855F", strokeWidth: f3(0.09 * m), strokeLinecap: "round" }} />
          </g>
        ))}
        <path d={torso} style={{ fill: ropa.camiseta, ...contorno }} />
        <path d={torso} style={{ fill: `url(#${id}-volumen)` }} />
        <path d={shorts} style={{ fill: `url(#${id}-volumen)` }} />
        {ropa.dorsal && (
          <text x={X(0)} y={Y(1.06)} textAnchor="middle" style={{ fontSize: f3(0.34 * m), fontWeight: 800, fill: ropa.tinta, fontFamily: FUENTE }}>
            {ropa.dorsal}
          </text>
        )}
        {/* Cuello y cabeza (de espaldas: pelo) */}
        <path d={`M ${X(0)} ${Y(1.5)} L ${X(0)} ${Y(1.56)}`} style={{ stroke: "#B9855F", strokeWidth: f3(0.1 * m) }} />
        <circle cx={X(0)} cy={Y(1.67)} r={f3(0.125 * m)} style={{ fill: "#2B211B", ...contorno }} />
        <circle cx={X(-0.04)} cy={Y(1.71)} r={f3(0.05 * m)} style={{ fill: "rgba(255,255,255,0.14)" }} />
      </g>
    );
  };

  const pintaNuestro = (i: number, p: Punto) => {
    const r = rutina.roles[i];

    const j = porId.get(r.jugador);

    const hueco = HUECO[r.papel];

    const foto = fotoDe(j);

    const activa = seleccionado === i;

    const texto = textoFicha(r, j);

    const clip = `${id}-c${i}`;

    const esRematador = remate?.quien === i && t >= VUELO[1] - 0.02;

    const comun = {
      role: M.onFicha ? "button" : undefined,
      tabIndex: M.onFicha ? 0 : undefined,
      "aria-label": M.etiquetaFicha?.(i),
      "aria-pressed": M.onFicha ? activa : undefined,
      "data-ficha": M.onFicha ? "" : undefined,
      onPointerDown: M.onFicha ? (e: PE<SVGGElement>) => M.onFicha!(e, i) : undefined,
      onKeyDown: M.onTeclaFicha ? (e: KE<SVGGElement>) => M.onTeclaFicha!(e, i) : undefined,
      onFocus: M.onFocoFicha ? () => M.onFocoFicha!(i) : undefined,
      style: { cursor: cursor ?? "grab", outline: "none", opacity: apagado(i) ? 0.3 : undefined },
    };

    const protagonista = destacado === i;

    /* El aro late justo antes del remate: «ahora te toca». */
    const latido = protagonista && t > VUELO[1] - 0.2 && t < VUELO[1] + 0.05 ? 1 + 0.18 * Math.abs(Math.sin(t * 60)) : 1;

    /* --- En perspectiva: el jugador de pie, con su aro en el césped --- */
    if (cam.tresD) {
      const pie = g({ ...p, z: 0 });

      const m = metroDe(pie.s);

      const cabeza = pie.y - 1.85 * m;

      const R = Math.max(0.3 * m, u * 0.55);

      const placa = foto ? cabeza - R * 1.25 : cabeza;

      return (
        <g key={`n${i}`} {...comun}>
          {sombras(p, 1.85, 0.32, `sn${i}`)}
          {activa && aroSuelo(p, 0.95, P.texto, true)}
          {protagonista && aroSuelo(p, 1.15 * latido, ROSA, false, 0.24)}
          {esRematador && aroSuelo(p, 1.25, P.oro, false, 0.16)}
          {r.papel === "senuelo" && aroSuelo(p, 0.6, P.oro, true, 0.08)}
          {figura(p, { camiseta: P.oro, pantalon: "#F4F1EA", medias: "#F4F1EA", dorsal: j?.dorsal !== undefined ? String(j.dorsal) : CODIGO_PAPEL[r.papel], tinta: P.tinta }, hueco ? 0.82 : 1)}
          {foto && (
            <>
              <clipPath id={clip}>
                <circle cx={f3(pie.x)} cy={f3(placa)} r={f3(R * 0.88)} />
              </clipPath>
              <circle cx={f3(pie.x)} cy={f3(placa)} r={f3(R)} style={{ fill: "#1B2430", stroke: P.oro, strokeWidth: f3(R * 0.12) }} />
              <image href={foto} x={f3(pie.x - R * 0.88)} y={f3(placa - R * 0.88)} width={f3(R * 1.76)} height={f3(R * 1.76)} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMin slice" />
            </>
          )}
          {capas.nombres && !quieta && j && !protagonista && rotulo(pie.x, placa - (foto ? R * 1.35 : m * 0.28), nombreCorto(j.nombre), Math.max(m * 0.32, u * 0.92))}
          {protagonista && etiquetaTu(pie.x, placa - (foto ? R * 1.3 : m * 0.25), Math.max(m * 0.45, u * 1.6))}
          {M.onFicha && <rect x={f3(pie.x - Math.max(0.55 * m, u * 1.4))} y={f3(cabeza - 0.3 * m)} width={f3(Math.max(1.1 * m, u * 2.8))} height={f3(2.25 * m)} style={{ fill: "transparent" }} data-solo-pantalla="" />}
        </g>
      );
    }

    /* --- En cenital: la ficha redonda, con volumen --- */
    const c = g({ ...p, z: 0 });

    const R = radioFicha(c.s);

    return (
      <g key={`n${i}`} {...comun}>
        {sombras(p, 0.9, R * 0.95, `sn${i}`)}
        {protagonista && <circle cx={f3(c.x)} cy={f3(c.y)} r={f3(R * 1.55)} style={{ fill: "rgba(255,79,163,0.18)", stroke: ROSA, strokeWidth: f3(R * 0.2) }} />}
        {activa && <circle cx={f3(c.x)} cy={f3(c.y)} r={f3(R * 1.5)} style={{ fill: "none", stroke: P.texto, strokeWidth: f3(R * 0.12), strokeDasharray: `${f3(R * 0.4)} ${f3(R * 0.28)}` }} />}
        {esRematador && <circle cx={f3(c.x)} cy={f3(c.y)} r={f3(R * 1.9)} style={{ fill: "none", stroke: P.oro, strokeWidth: f3(R * 0.14), opacity: 0.9 }} />}
        <circle
          cx={f3(c.x)}
          cy={f3(c.y)}
          r={f3(R)}
          style={{
            fill: hueco && !foto ? "rgba(200,169,107,0.22)" : P.oro,
            stroke: hueco ? P.oro : "rgba(0,0,0,0.35)",
            strokeWidth: f3(R * (hueco ? 0.14 : 0.08)),
            strokeDasharray: r.papel === "senuelo" ? `${f3(R * 0.4)} ${f3(R * 0.26)}` : undefined,
          }}
        />
        {!hueco && !foto && <circle cx={f3(c.x)} cy={f3(c.y)} r={f3(R)} style={{ fill: `url(#${id}-esfera)` }} />}
        {foto ? (
          <>
            <clipPath id={clip}>
              <circle cx={f3(c.x)} cy={f3(c.y)} r={f3(R * 0.86)} />
            </clipPath>
            <circle cx={f3(c.x)} cy={f3(c.y)} r={f3(R * 0.86)} style={{ fill: "#1B2430" }} />
            <image href={foto} x={f3(c.x - R * 0.86)} y={f3(c.y - R * 0.86)} width={f3(R * 1.72)} height={f3(R * 1.72)} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMin slice" />
            {j?.dorsal !== undefined && (
              <>
                <circle cx={f3(c.x + R * 0.72)} cy={f3(c.y + R * 0.62)} r={f3(R * 0.42)} style={{ fill: P.tinta, stroke: P.oro, strokeWidth: f3(R * 0.06) }} />
                <text x={f3(c.x + R * 0.72)} y={f3(c.y + R * 0.62 + R * 0.15)} textAnchor="middle" style={{ fontSize: f3(R * 0.46), fontWeight: 800, fill: P.oro, fontFamily: FUENTE }}>
                  {j.dorsal}
                </text>
              </>
            )}
          </>
        ) : (
          <text x={f3(c.x)} y={f3(c.y + R * 0.36)} textAnchor="middle" style={{ fontSize: f3(texto.length > 2 ? R * 0.8 : R * 1.02), fontWeight: 800, fill: hueco ? P.texto : P.tinta, fontFamily: FUENTE }}>
            {texto}
          </text>
        )}
        {capas.nombres && !quieta && j && !protagonista && rotulo(c.x, c.y + R + Math.max(R * 0.95, u * 0.95), nombreCorto(j.nombre), Math.max(R * 0.8, u * 0.92))}
        {protagonista && etiquetaTu(c.x, c.y - R * 1.75, Math.max(R * 0.95, u * 1.2))}
        {/* Un blanco más grande que la ficha: con el dedo, la ficha es poca cosa */}
        {M.onFicha && <circle cx={f3(c.x)} cy={f3(c.y)} r={f3(Math.max(R * 1.7, u * 1.8))} style={{ fill: "transparent" }} data-solo-pantalla="" />}
      </g>
    );
  };

  const pintaSuyo = (k: number, p: Punto) => {
    if (!defensa) return null;

    const d = defensa.plan[k];

    const bloqueado = defensa.estado.bloqueado[k];

    const color = d.papel === "portero" ? P.portero : P.rival;


    if (cam.tresD) {
      return (
        <g key={`s${k}`} style={{ pointerEvents: "none" }}>
          {sombras(p, 1.85, 0.32, `ss${k}`)}
          {bloqueado && aroSuelo(p, 0.85, P.bloqueo, false, 0.12)}
          {figura(p, { camiseta: color, pantalon: d.papel === "portero" ? "#1B1B1B" : "#2A0A12", medias: color, dorsal: d.dorsal ?? null, tinta: d.papel === "portero" ? P.tinta : P.rivalTexto }, 1)}
        </g>
      );
    }

    const c = g({ ...p, z: 0 });

    const R = radioFicha(c.s) * 0.86;

    return (
      <g key={`s${k}`} style={{ pointerEvents: "none" }}>
        {sombras(p, 0.9, R * 0.9, `ss${k}`)}
        {bloqueado && <circle cx={f3(c.x)} cy={f3(c.y)} r={f3(R * 1.45)} style={{ fill: "none", stroke: P.bloqueo, strokeWidth: f3(R * 0.11), opacity: 0.9 }} />}
        <rect x={f3(c.x - R * 0.78)} y={f3(c.y - R * 0.78)} width={f3(R * 1.56)} height={f3(R * 1.56)} rx={f3(R * 0.28)} transform={`rotate(45 ${f3(c.x)} ${f3(c.y)})`} style={{ fill: color, stroke: "rgba(0,0,0,0.45)", strokeWidth: f3(R * 0.08) }} />
        <rect x={f3(c.x - R * 0.78)} y={f3(c.y - R * 0.78)} width={f3(R * 1.56)} height={f3(R * 1.56)} rx={f3(R * 0.28)} transform={`rotate(45 ${f3(c.x)} ${f3(c.y)})`} style={{ fill: `url(#${id}-esfera)` }} />
        {d.dorsal && (
          <text x={f3(c.x)} y={f3(c.y + R * 0.34)} textAnchor="middle" style={{ fontSize: f3(R * 0.95), fontWeight: 800, fill: d.papel === "portero" ? P.tinta : P.rivalTexto, fontFamily: FUENTE }}>
            {d.dorsal}
          </text>
        )}
      </g>
    );
  };

  /* El vuelo entero, muestreado en el tiempo: lo ya recorrido y lo que falta. */
  const vuelo = (de: number, a: number, n = 22) =>
    a <= de
      ? []
      : Array.from({ length: n + 1 }, (_, k) => {
          const e = estadoBalon(camino, de + ((a - de) * k) / n, envio, rutina.tipo);

          return { aire: g({ ...e.suelo, z: e.z }), suelo: g({ ...e.suelo, z: 0 }) };
        });

  const trazo = (pts: { x: number; y: number }[]) => pts.map((q, k) => `${k ? "L" : "M"} ${f3(q.x)} ${f3(q.y)}`).join(" ");

  const pintaBalon = () => {
    const s = g({ ...balon.suelo, z: 0 });

    const c = g({ ...balon.suelo, z: balon.z });

    const R = cam.tresD ? Math.max(0.24 * c.s, u * 0.3) : 0.55 + balon.z * 0.04;

    const sombraR = R * Math.max(0.45, 1 - balon.z * 0.05);

    return (
      <g key="balon" style={{ pointerEvents: "none" }}>
        <ellipse cx={f3(s.x)} cy={f3(s.y)} rx={f3(sombraR)} ry={f3(cam.tresD ? sombraR * 0.4 : sombraR)} style={{ fill: P.sombra, opacity: Math.max(0.35, 1 - balon.z * 0.07) }} />
        {balon.z > 0.3 && <path d={`M ${f3(s.x)} ${f3(s.y)} L ${f3(c.x)} ${f3(c.y)}`} style={{ stroke: "rgba(255,255,255,0.22)", strokeWidth: f3(R * 0.12), strokeDasharray: `${f3(R * 0.3)} ${f3(R * 0.3)}` }} />}
        {balon.enVuelo && <circle cx={f3(c.x)} cy={f3(c.y)} r={f3(R * 2.1)} style={{ fill: `url(#${id}-brillo)` }} />}
        <circle cx={f3(c.x)} cy={f3(c.y)} r={f3(R)} style={{ fill: `url(#${id}-bola)`, stroke: "rgba(11,15,20,0.75)", strokeWidth: f3(R * 0.1) }} />
        <path d={`M ${f3(c.x - R * 0.22)} ${f3(c.y - R * 0.3)} l ${f3(R * 0.3)} ${f3(-R * 0.05)} l ${f3(R * 0.12)} ${f3(R * 0.28)} l ${f3(-R * 0.2)} ${f3(R * 0.22)} l ${f3(-R * 0.26)} ${f3(-R * 0.1)} Z`} style={{ fill: "rgba(11,15,20,0.8)" }} />
      </g>
    );
  };

  /* ----------------------------- carreras ------------------------------ */

  const flecha = (de: Punto, a: Punto, color: string, discontinua: boolean, clave: string) => {
    const d = Math.hypot(a.x - de.x, a.y - de.y);

    if (d < 0.5 || !seVe(de) || !seVe(a)) return null;

    const corto = Math.max(0, d - 1.1) / d;

    const fin = { x: de.x + (a.x - de.x) * corto, y: de.y + (a.y - de.y) * corto };

    const p = g({ ...de, z: 0 });

    const q = g({ ...fin, z: 0 });

    const ancho = cam.tresD ? Math.max(0.16 * q.s, u * 0.16) : 0.26;

    /* La punta en pantalla, con la dirección del último tramo. */
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const n = Math.hypot(dx, dy) || 1;
    const ux = dx / n;
    const uy = dy / n;
    const L = ancho * 4.2;

    const punta = `M ${f3(q.x + ux * L * 0.4)} ${f3(q.y + uy * L * 0.4)} L ${f3(q.x - ux * L * 0.6 - uy * L * 0.5)} ${f3(q.y - uy * L * 0.6 + ux * L * 0.5)} L ${f3(q.x - ux * L * 0.6 + uy * L * 0.5)} ${f3(q.y - uy * L * 0.6 - ux * L * 0.5)} Z`;

    return (
      <g key={clave} style={{ pointerEvents: "none" }}>
        <path d={`M ${f3(p.x)} ${f3(p.y)} L ${f3(q.x - ux * L * 0.5)} ${f3(q.y - uy * L * 0.5)}`} style={{ fill: "none", stroke: P.halo, strokeWidth: f3(ancho * 2.1), strokeLinecap: "round", opacity: 0.35 }} />
        <path d={`M ${f3(p.x)} ${f3(p.y)} L ${f3(q.x - ux * L * 0.5)} ${f3(q.y - uy * L * 0.5)}`} style={{ fill: "none", stroke: color, strokeWidth: f3(ancho), strokeLinecap: "round", strokeDasharray: discontinua ? `${f3(ancho * 2.6)} ${f3(ancho * 1.8)}` : undefined }} />
        <path d={punta} style={{ fill: color }} />
      </g>
    );
  };

  /* El bloqueo: la barra en T al final de su carrera (o delante de él, si no corre). */
  const bloqueos = rutina.roles.map((r, i) => {
    if (r.papel !== "bloqueador") return null;

    const fin = r.hx !== undefined && r.hy !== undefined ? { x: r.hx, y: r.hy } : desde[i];

    const dir = r.hx !== undefined && r.hy !== undefined ? { x: r.hx - desde[i].x, y: r.hy - desde[i].y } : { x: 34 - desde[i].x, y: -desde[i].y };

    const n = Math.hypot(dir.x, dir.y) || 1;

    const nx = -dir.y / n;
    const ny = dir.x / n;

    const delante = { x: fin.x + (dir.x / n) * 0.7, y: fin.y + (dir.y / n) * 0.7 };

    const a = { x: delante.x + nx * 0.95, y: delante.y + ny * 0.95 };
    const b = { x: delante.x - nx * 0.95, y: delante.y - ny * 0.95 };

    const ancho = cam.tresD ? Math.max(0.2 * g({ ...delante, z: 0 }).s, u * 0.18) : 0.34;

    const activo = t >= (r.hx !== undefined ? tramoDe(r)[0] : 0);

    return <path key={`bl${i}`} d={linea(cam, { ...a, z: 0 }, { ...b, z: 0 })} style={{ stroke: P.bloqueo, strokeWidth: f3(ancho), strokeLinecap: "round", opacity: activo ? 0.95 : 0.55, pointerEvents: "none" }} />;
  });

  /* ------------------------------- balón ------------------------------- */

  /*
   * La trayectoria: la sombra por el suelo, lo que falta por volar en
   * discontinuo y lo ya volado en trazo lleno con su estela de luz, como el
   * grafismo de una retransmisión. Antes del golpeo se ve entera, de aviso.
   */
  const anchoVuelo = cam.tresD ? Math.max(0.12 * cam.escala, u * 0.1) : 0.2;

  const tVuelo = Math.min(Math.max(t, VUELO[0]), VUELO[1]);

  const volado = vuelo(VUELO[0], tVuelo);

  const porVolar = vuelo(tVuelo, VUELO[1]);

  const entero = vuelo(VUELO[0], VUELO[1], 30);

  const recorridos = (
    <g key="rb" style={{ pointerEvents: "none" }}>
      {entero.length > 1 && <path d={trazo(entero.map((q) => q.suelo))} style={{ fill: "none", stroke: P.sombra, strokeWidth: f3(anchoVuelo * 1.4), strokeDasharray: `${f3(anchoVuelo * 2.5)} ${f3(anchoVuelo * 2)}` }} />}
      {porVolar.length > 1 && <path d={trazo(porVolar.map((q) => q.aire))} style={{ fill: "none", stroke: P.balon, strokeWidth: f3(anchoVuelo), strokeDasharray: `${f3(anchoVuelo * 3.6)} ${f3(anchoVuelo * 2.2)}`, opacity: t < VUELO[0] ? 0.8 : 0.55 }} />}
      {volado.length > 1 && (
        <>
          <path d={trazo(volado.map((q) => q.aire))} style={{ fill: "none", stroke: P.oro, strokeWidth: f3(anchoVuelo * 3.2), strokeLinecap: "round", opacity: 0.28 }} />
          <path d={trazo(volado.map((q) => q.aire))} style={{ fill: "none", stroke: P.balon, strokeWidth: f3(anchoVuelo * 1.15), strokeLinecap: "round", opacity: 0.95 }} />
        </>
      )}
    </g>
  );

  /* Dónde va a caer: una diana en el césped desde un poco antes del golpeo hasta que llega el remate. */
  const caida = camino.at(-1)!;

  const verDiana = !quieta && camino.length > 1 && t >= VUELO[0] - 0.15 && t < VUELO[1] - 0.12;

  /* Las estelas de carrera: por dónde ha pasado cada uno que corre, apagándose hacia atrás. */
  /* Los ocho instantes de atrás, de todos a la vez: la salida de cada uno depende de los demás de su zona. */
  const pasados = quieta || !rutina.roles.some((r) => r.hx !== undefined) ? [] : Array.from({ length: 8 }, (_, k) => posicionesEn(rutina.roles, Math.max(0, t - k * 0.018)));

  const estelas = !pasados.length
    ? []
    : rutina.roles.flatMap((r, i) => {
        if (r.hx === undefined || r.hy === undefined || !seVe(nuestros[i])) return [];

        const atras = pasados.map((pos) => pos[i]);

        if (Math.hypot(atras[0].x - atras[7].x, atras[0].y - atras[7].y) < 0.6) return [];

        const color = P.fase[r.fase ?? 2];

        return atras.slice(1).map((q, k) => {
          const pa = g({ ...atras[k], z: 0 });
          const pb = g({ ...q, z: 0 });

          const w = (cam.tresD ? Math.max(0.3 * pa.s, u * 0.24) : 0.5) * (1 - k / 8);

          return <path key={`es${i}-${k}`} d={`M ${f3(pa.x)} ${f3(pa.y)} L ${f3(pb.x)} ${f3(pb.y)}`} style={{ stroke: color, strokeWidth: f3(w), strokeLinecap: "round", opacity: 0.5 * (1 - k / 7), pointerEvents: "none" }} />;
        });
      });

  /* ------------------------------ lecturas ----------------------------- */

  /* En el vídeo de un jugador no van las lecturas (xG, «Nadie llega»): a ese tamaño no se leen y tapan la jugada. */
  const verLecturas = !quieta && destacado === null;

  const enRemate = t >= VUELO[1] - 0.12;

  return (
    <svg
      ref={svgRef}
      viewBox={`${f3(caja.x)} ${f3(caja.y)} ${f3(caja.w)} ${f3(caja.h)}`}
      className={`block w-full select-none ${className}`}
      style={{ touchAction: M.onFondo ? "none" : undefined, cursor, aspectRatio: `${caja.w} / ${caja.h}` }}
      role={M.onFondo ? "application" : "img"}
      aria-label={etiqueta}
      onPointerDown={M.onFondo}
      onPointerMove={M.onMueve}
      onPointerUp={M.onSuelta}
      onPointerCancel={M.onSuelta}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`${id}-cielo`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.cielo} />
          <stop offset="1" stopColor={P.grada} />
        </linearGradient>
        <radialGradient id={`${id}-luz`} cx="0.5" cy="0.32" r="0.75">
          <stop offset="0" stopColor={P.luz} />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id={`${id}-foco1`} cx="0.08" cy="0" r="0.6">
          <stop offset="0" stopColor={P.luz} />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id={`${id}-foco2`} cx="0.92" cy="0" r="0.6">
          <stop offset="0" stopColor={P.luz} />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id={`${id}-vineta`} cx="0.5" cy="0.5" r="0.72">
          <stop offset="0.6" stopColor="rgba(0,0,0,0)" />
          <stop offset="1" stopColor={P.vineta} />
        </radialGradient>
        {/* El volumen de camisetas y fichas: luz por la izquierda, sombra por la derecha */}
        <linearGradient id={`${id}-volumen`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(255,255,255,0.32)" />
          <stop offset="0.45" stopColor="rgba(255,255,255,0)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.34)" />
        </linearGradient>
        <radialGradient id={`${id}-esfera`} cx="0.36" cy="0.32" r="0.75">
          <stop offset="0" stopColor="rgba(255,255,255,0.42)" />
          <stop offset="0.5" stopColor="rgba(255,255,255,0)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.3)" />
        </radialGradient>
        <radialGradient id={`${id}-bola`} cx="0.35" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#E3E7EB" />
          <stop offset="1" stopColor="#9AA3AD" />
        </radialGradient>
        <radialGradient id={`${id}-brillo`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        {/* La profundidad: el césped de lejos, más apagado */}
        <linearGradient id={`${id}-lejos`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.nombre === "noche" ? "rgba(0,0,0,0.4)" : "rgba(40,70,50,0.28)"} />
          <stop offset="0.55" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
        <filter id={`${id}-difumina`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={f3(cam.tresD ? 0.55 * cam.escala : 0.55)} />
        </filter>
      </defs>

      {/* El estadio y el césped */}
      <rect x={caja.x} y={caja.y} width={caja.w} height={caja.h} style={{ fill: `url(#${id}-cielo)` }} />
      <path d={poligono(cam, [{ x: -4, y: -4 }, { x: ANCHO + 4, y: -4 }, { x: ANCHO + 4, y: Math.min(fondo + 4, cam.yMax) }, { x: -4, y: Math.min(fondo + 4, cam.yMax) }])} style={{ fill: P.orilla }} />
      <path d={poligono(cam, [{ x: 0, y: 0 }, { x: ANCHO, y: 0 }, { x: ANCHO, y: fondo }, { x: 0, y: fondo }])} style={{ fill: P.cesped }} />
      {cam.tresD && (
        <>
          {/* La grada y las vallas de detrás de la portería */}
          <path d={poligono(cam, [{ x: -14, y: -4.2, z: 1 }, { x: ANCHO + 14, y: -4.2, z: 1 }, { x: ANCHO + 14, y: -16, z: 11 }, { x: -14, y: -16, z: 11 }])} style={{ fill: P.publico }} />
          {Array.from({ length: 5 }, (_, k) => (
            <path key={`gr${k}`} d={linea(cam, { x: -14, y: -4.2 - k * 2.4, z: 1 + k * 2 }, { x: ANCHO + 14, y: -4.2 - k * 2.4, z: 1 + k * 2 })} style={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: f3(u * 0.08) }} />
          ))}
          <path d={poligono(cam, [{ x: 2, y: -3.4, z: 0 }, { x: ANCHO - 2, y: -3.4, z: 0 }, { x: ANCHO - 2, y: -3.4, z: 0.9 }, { x: 2, y: -3.4, z: 0.9 }])} style={{ fill: P.valla }} />
          <path d={linea(cam, { x: 2, y: -3.4, z: 0.62 }, { x: ANCHO - 2, y: -3.4, z: 0.62 })} style={{ stroke: P.oro, strokeWidth: f3(u * 0.1), opacity: 0.85 }} />
        </>
      )}
      {franjas.map((i) =>
        i % 2 ? (
          <path
            key={`fr${i}`}
            d={poligono(cam, [
              { x: 0, y: i * 5.5 },
              { x: ANCHO, y: i * 5.5 },
              { x: ANCHO, y: Math.min(fondo, (i + 1) * 5.5) },
              { x: 0, y: Math.min(fondo, (i + 1) * 5.5) },
            ])}
            style={{ fill: P.franja }}
          />
        ) : null,
      )}
      {/* El damero del corte, muy suave, y la boca de gol pisada */}
      {Array.from({ length: 12 }, (_, k) =>
        k % 2 ? <path key={`dm${k}`} d={poligono(cam, [{ x: k * 5.67, y: 0 }, { x: (k + 1) * 5.67, y: 0 }, { x: (k + 1) * 5.67, y: fondo }, { x: k * 5.67, y: fondo }])} style={{ fill: "rgba(255,255,255,0.025)" }} /> : null,
      )}
      <path d={elipseSuelo({ x: 34, y: 2.6 }, 6.5, 2.3)} style={{ fill: P.gastado }} />
      <path d={elipseSuelo({ x: 34, y: 11 }, 1.6, 1.1)} style={{ fill: P.gastado }} />
      {cam.tresD && <path d={poligono(cam, [{ x: 0, y: 0 }, { x: ANCHO, y: 0 }, { x: ANCHO, y: fondo }, { x: 0, y: fondo }])} style={{ fill: `url(#${id}-lejos)`, pointerEvents: "none" }} />}
      <rect x={caja.x} y={caja.y} width={caja.w} height={caja.h} style={{ fill: `url(#${id}-luz)`, pointerEvents: "none" }} />
      {P.nombre === "noche" && (
        <>
          <rect x={caja.x} y={caja.y} width={caja.w} height={caja.h} style={{ fill: `url(#${id}-foco1)`, pointerEvents: "none" }} />
          <rect x={caja.x} y={caja.y} width={caja.w} height={caja.h} style={{ fill: `url(#${id}-foco2)`, pointerEvents: "none" }} />
        </>
      )}

      {/* Las líneas */}
      <g style={{ pointerEvents: "none" }}>
        <path d={`${linea(cam, { x: 0, y: fondo }, { x: 0, y: 0 })} ${linea(cam, { x: 0, y: 0 }, { x: ANCHO, y: 0 })} ${linea(cam, { x: ANCHO, y: 0 }, { x: ANCHO, y: fondo })}`} style={estiloLinea} />
        {fondo > LARGO && <path d={linea(cam, { x: 0, y: LARGO }, { x: ANCHO, y: LARGO })} style={estiloLinea} />}
        <path d={poligono(cam, [{ x: AREA.x0, y: 0 }, { x: AREA.x1, y: 0 }, { x: AREA.x1, y: AREA.y }, { x: AREA.x0, y: AREA.y }])} style={estiloLinea} />
        <path d={poligono(cam, [{ x: AREA_PEQUENA.x0, y: 0 }, { x: AREA_PEQUENA.x1, y: 0 }, { x: AREA_PEQUENA.x1, y: AREA_PEQUENA.y }, { x: AREA_PEQUENA.x0, y: AREA_PEQUENA.y }])} style={estiloLinea} />
        <path
          d={curva(cam, (v) => {
            const a0 = Math.atan2(AREA.y - PENALTI.y, -dxArco);
            const a1 = Math.atan2(AREA.y - PENALTI.y, dxArco);
            const a = a0 + (a1 - a0) * v;

            return { x: PENALTI.x + 9.15 * Math.cos(a), y: PENALTI.y + 9.15 * Math.sin(a) };
          })}
          style={estiloLinea}
        />
        <path d={curva(cam, (v) => ({ x: PENALTI.x + 0.18 * Math.cos(v * Math.PI * 2), y: PENALTI.y + 0.18 * Math.sin(v * Math.PI * 2) }), 10)} style={{ fill: P.linea }} />
        <path d={curva(cam, (v) => ({ x: Math.sin((v * Math.PI) / 2), y: Math.cos((v * Math.PI) / 2) }), 8)} style={estiloLinea} />
        <path d={curva(cam, (v) => ({ x: ANCHO - Math.sin((v * Math.PI) / 2), y: Math.cos((v * Math.PI) / 2) }), 8)} style={estiloLinea} />
        {fondo > LARGO + 9.5 ? (
          <path d={curva(cam, (v) => ({ x: 34 + 9.15 * Math.cos(v * Math.PI * 2), y: LARGO + 9.15 * Math.sin(v * Math.PI * 2) }), 40)} style={estiloLinea} />
        ) : fondo > LARGO ? (
          <path d={curva(cam, (v) => ({ x: 34 - 9.15 * Math.cos(v * Math.PI), y: LARGO - 9.15 * Math.sin(v * Math.PI) }))} style={estiloLinea} />
        ) : null}
        {/* Banderines */}
        {[0, ANCHO].map((x) => (
          <g key={`bd${x}`}>
            <path d={linea(cam, { x, y: 0, z: 0 }, { x, y: 0, z: 1.5 })} style={{ stroke: P.linea, strokeWidth: f3(anchoLinea * 0.9) }} />
            <path d={poligono(cam, [{ x, y: 0, z: 1.5 }, { x: x + (x ? -0.7 : 0.7), y: 0, z: 1.3 }, { x, y: 0, z: 1.1 }])} style={{ fill: P.oro }} />
          </g>
        ))}
        {/* La portería */}
        {redes.map((d, i) => (
          <path key={`red${i}`} d={d} style={{ fill: P.red, opacity: 0.35 }} />
        ))}
        {mallas.map((d, i) => (
          <path key={`m${i}`} d={d} style={{ stroke: P.red, strokeWidth: f3(anchoLinea * 0.45), fill: "none" }} />
        ))}
        {palos.map((d, i) => (
          <path key={`p${i}`} d={d} style={{ stroke: "#FFFFFF", strokeWidth: f3(anchoLinea * 1.6), strokeLinecap: "round" }} />
        ))}
      </g>

      {/* El espacio: quién llega antes a cada metro cuadrado del área */}
      {verLecturas && capas.ventaja && celdas && celdas.length > 0 && (
        <g filter={`url(#${id}-difumina)`} style={{ pointerEvents: "none" }}>
          {celdas.map((c, i) => {
            const nuestro = c.p > 0.5;

            const a = Math.min(0.42, Math.abs(c.p - 0.5) * 0.95);

            return (
              <path
                key={`cc${i}`}
                d={poligono(cam, [
                  { x: c.x - 0.52, y: c.y - 0.52 },
                  { x: c.x + 0.52, y: c.y - 0.52 },
                  { x: c.x + 0.52, y: c.y + 0.52 },
                  { x: c.x - 0.52, y: c.y + 0.52 },
                ])}
                style={{ fill: `rgba(${nuestro ? P.nuestro : P.suyo},${a.toFixed(3)})` }}
              />
            );
          })}
        </g>
      )}
      {verLecturas && capas.ventaja && libres && libres.length > 0 && (
        <g style={{ pointerEvents: "none" }}>
          {libres.map((p, i) => {
            const c = g({ ...p, z: 0 });

            return <circle key={`lb${i}`} cx={f3(c.x)} cy={f3(c.y)} r={f3(cam.tresD ? 0.16 * c.s : 0.16)} style={{ fill: P.texto, opacity: 0.45 }} />;
          })}
        </g>
      )}

      {/* La llegada: dónde pisan los nuestros mientras vuela el balón */}
      {verLecturas && llegada && llegada.length > 0 && (
        <g filter={`url(#${id}-difumina)`} style={{ pointerEvents: "none" }}>
          {llegada.map((c, i) => (
            <path
              key={`ll${i}`}
              d={poligono(cam, [
                { x: c.x - 0.52, y: c.y - 0.52 },
                { x: c.x + 0.52, y: c.y - 0.52 },
                { x: c.x + 0.52, y: c.y + 0.52 },
                { x: c.x - 0.52, y: c.y + 0.52 },
              ])}
              style={{ fill: c.p > 0.75 ? `rgba(255,244,214,${(0.3 + c.p * 0.4).toFixed(3)})` : `rgba(${P.nuestro},${(0.12 + c.p * 0.5).toFixed(3)})` }}
            />
          ))}
        </g>
      )}

      {/* El balón: sombra por el suelo y vuelo por el aire */}
      {recorridos}
      {verDiana && (
        <g style={{ pointerEvents: "none" }}>
          <path d={elipseSuelo(caida, 1.1, 1.1, 0, 28)} style={{ fill: "rgba(255,255,255,0.08)", stroke: P.balon, strokeWidth: f3(anchoVuelo * 0.9), opacity: 0.85 }} />
          <path d={elipseSuelo(caida, 0.45, 0.45, 0, 20)} style={{ fill: P.oro, opacity: 0.6 }} />
        </g>
      )}
      {estelas}

      {/* Las carreras y los bloqueos */}
      {rutina.roles.map((r, i) =>
        r.hx !== undefined && r.hy !== undefined ? (
          <g key={`gfl${i}`} opacity={apagado(i) ? 0.3 : undefined}>
            {flecha(desde[i], { x: r.hx, y: r.hy }, destacado === i ? ROSA : P.fase[r.fase ?? 2], (r.fase ?? 2) === 1, `fl${i}`)}
          </g>
        ) : null,
      )}
      {bloqueos}

      {/* Las salidas, en fantasma, cuando la jugada ya se ha movido */}
      {t > 0 &&
        rutina.roles.map((r, i) => {
          if (r.hx === undefined || !seVe(desde[i])) return null;

          const c = g({ ...desde[i], z: 0 });

          return <circle key={`gh${i}`} cx={f3(c.x)} cy={f3(c.y)} r={f3(cam.tresD ? 0.6 * c.s : 1.1)} style={{ pointerEvents: "none", fill: "none", stroke: "rgba(255,255,255,0.3)", strokeWidth: f3(cam.tresD ? 0.06 * c.s : 0.12) }} />;
        })}

      {/* Los bloqueos en acción: la línea entre el bloqueador y el defensor que frena */}
      {defensa &&
        defensa.plan.map((d, k) => {
          if (!defensa.estado.bloqueado[k]) return null;

          const pk = defensa.estado.pos[k];

          let mejor = -1;
          let dist = Infinity;

          rutina.roles.forEach((r, i) => {
            if (r.papel !== "bloqueador") return;

            const n = Math.hypot(nuestros[i].x - pk.x, nuestros[i].y - pk.y);

            if (n < dist) {
              dist = n;
              mejor = i;
            }
          });

          if (mejor < 0) return null;

          return <path key={`bk${k}`} d={linea(cam, { ...nuestros[mejor], z: 0.2 }, { ...pk, z: 0.2 })} style={{ stroke: P.bloqueo, strokeWidth: f3(cam.tresD ? 0.22 * cam.escala : 0.32), strokeLinecap: "round", pointerEvents: "none" }} />;
        })}

      {/* Los duelos aéreos en el remate */}
      {verLecturas && capas.duelos && enRemate && duelos && defensa && (
        <g style={{ pointerEvents: "none" }}>
          {duelos.map((d) => {
            const a = g({ ...nuestros[d.nuestro], z: levanta });

            const b = g({ ...defensa.estado.pos[d.suyo], z: levanta });

            const color = d.difCm === null ? P.texto : d.difCm >= 3 ? "#34D399" : d.difCm <= -3 ? "#F87171" : P.oro;

            const mx = (a.x + b.x) / 2;
            const my = Math.min(a.y, b.y) - radioFicha(a.s) * 1.6;

            return (
              <g key={`du${d.nuestro}-${d.suyo}`}>
                <path d={`M ${f3(a.x)} ${f3(a.y)} L ${f3(b.x)} ${f3(b.y)}`} style={{ stroke: color, strokeWidth: f3(u * 0.12), strokeDasharray: `${f3(u * 0.3)} ${f3(u * 0.2)}` }} />
                {d.difCm !== null && rotulo(mx, my, `${d.difCm > 0 ? "+" : ""}${d.difCm} cm`, u * 1.05, color, 800)}
              </g>
            );
          })}
        </g>
      )}

      {/* Las fichas y el balón, de lejos a cerca */}
      {piezas.map((p) => (p.tipo === "nuestro" ? pintaNuestro(p.i, p.p) : p.tipo === "suyo" ? pintaSuyo(p.k, p.p) : pintaBalon()))}

      {/* Su par (el que le marca o al que marca), por encima de todo: si no, los muñecos lo tapaban. */}
      {cam.tresD && destacado !== null && defensa && (() => {
        const k = defensa.plan.findIndex((d) => d.sigue === destacado);

        if (k < 0) return null;

        const p = defensa.estado.pos[k];
        const pie = g({ ...p, z: 0 });
        const m = metroDe(pie.s);
        const suyo = g({ ...nuestros[destacado], z: 0 });

        /* La etiqueta donde no choca con su «TÚ»: debajo del par o, si el par está detrás de él, a un lado. */
        const abajo = pie.y >= suyo.y;

        return (
          <g style={{ pointerEvents: "none" }}>
            <path d={`M ${f3(suyo.x)} ${f3(suyo.y)} L ${f3(pie.x)} ${f3(pie.y)}`} style={{ stroke: ROSA, strokeWidth: f3(Math.max(0.12 * m, u * 0.16)), strokeLinecap: "round" }} />
            {etiquetaTu(abajo ? pie.x : pie.x + (pie.x >= suyo.x ? 1 : -1) * u * 4.2, abajo ? pie.y + Math.max(1.1 * m, u * 2.6) : pie.y - 1.2 * m, Math.max(m * 0.45, u * 1.6), rutina.lado === "ofensivo" ? "TE MARCA" : "TU HOMBRE")}
          </g>
        );
      })()}

      {/* El remate: dónde cae y su xG */}
      {verLecturas && remate && enRemate && !remate.directo && (
        <g style={{ pointerEvents: "none" }}>
          {(() => {
            const c = g({ ...remate.caida, z: 0 });

            const R = cam.tresD ? 1.6 * c.s : 1.6;

            const etiquetaXg = remate.quien === null ? "Nadie llega" : `xG ${comaXg(remate.xg)}`;

            return (
              <>
                <ellipse cx={f3(c.x)} cy={f3(c.y)} rx={f3(R)} ry={f3(cam.tresD ? R * 0.42 : R)} style={{ fill: "none", stroke: P.oro, strokeWidth: f3(u * 0.14), strokeDasharray: `${f3(u * 0.45)} ${f3(u * 0.25)}` }} />
                {rotulo(c.x, c.y - (cam.tresD ? R * 0.42 : R) - u * 2.6, etiquetaXg, u * 1.5, P.oro, 800)}
              </>
            );
          })()}
        </g>
      )}

      {/* Los puntos del recorrido del balón, para moverlos */}
      {editaBalon &&
        camino.map((p, i) => {
          const c = g({ ...p, z: 0 });

          const R = cam.tresD ? Math.max(0.5 * c.s, u * 0.55) : 0.75;

          return (
            <g key={`pb${i}`} data-solo-pantalla="" onPointerDown={M.onPuntoBalon ? (e) => M.onPuntoBalon!(e, i) : undefined} onDoubleClick={M.onQuitaPunto ? () => M.onQuitaPunto!(i) : undefined} style={{ cursor: "move" }}>
              <circle cx={f3(c.x)} cy={f3(c.y)} r={f3(R * 2.1)} style={{ fill: "transparent" }} />
              <circle cx={f3(c.x)} cy={f3(c.y)} r={f3(R)} style={{ fill: i === 0 ? P.balon : "rgba(255,255,255,0.18)", stroke: P.balon, strokeWidth: f3(R * 0.2) }} />
              {rotulo(c.x, c.y - R * 1.6, i === 0 ? "golpeo" : String(i), Math.max(R * 1.1, u * 0.9))}
            </g>
          );
        })}

      {/* La viñeta, por encima de todo menos de lo que se toca */}
      <rect x={caja.x} y={caja.y} width={caja.w} height={caja.h} style={{ fill: `url(#${id}-vineta)`, pointerEvents: "none" }} />
    </svg>
  );
}

/** Lo que se pinta de la defensa: «el rival tipo» o el próximo rival con sus jugadores. */
export type DefensaEnEscena = { plan: Defensor[]; estado: EstadoDefensa } | null;
