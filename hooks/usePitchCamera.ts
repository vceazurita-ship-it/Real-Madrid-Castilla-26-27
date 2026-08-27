"use client";

/**
 * Cámara compartida por todas las pizarras.
 *
 * El campo se sigue dibujando en SVG (espacio 100 x 68). Lo que hace este
 * hook es colocar ese plano dentro de un contenedor con `perspective` y
 * moverlo con una matriz 4x4: inclinarlo (tilt), girarlo (yaw), acercarlo
 * (zoom) y desplazarlo (pan). Así hay perspectiva de verdad —retransmisión,
 * portería— sin tocar ni una línea del dibujo.
 *
 * La matriz se construye a mano, sin `DOMMatrix`, para que el primer render
 * del servidor coincida con el del navegador.
 *
 * Como el puntero cae sobre un plano inclinado, `unproject` deshace la
 * proyección y devuelve el punto del campo que hay debajo del cursor. Sin
 * eso, dibujar en modo retransmisión pintaría desplazado.
 *
 * El arrastre no vive en la capa que lo empieza sino en `window`: así la
 * cámara sigue moviéndose aunque el puntero se salga del campo, y el mismo
 * gesto puede arrancar desde la capa de navegación o desde un atajo (rueda
 * central, Alt, dos dedos) sobre el propio dibujo.
 */

import {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------

export type PitchCameraMode =
  | "broadcast"
  | "top"
  | "goal"
  | "follow"
  | "jugador";

/** `2d` apaga la perspectiva y aplana el campo; `3d` la enciende. */
export type PitchRender = "2d" | "3d";

/** Lo único que se necesita de un evento para mover la cámara. */
export interface PointerSample {
  pointerId: number;
  clientX: number;
  clientY: number;
}

/** Punto de pantalla al que se ancla el zoom. */
export interface ScreenAnchor {
  clientX: number;
  clientY: number;
}

export interface CameraPose {
  /** Inclinación sobre el eje X, en grados. 0 es cenital. */
  tilt: number;
  /** Giro cenital sobre el eje Z, en grados. */
  yaw: number;
  zoom: number;
  /** Desplazamiento en píxeles de pantalla. */
  panX: number;
  panY: number;
  /** Punto del plano que queda centrado, en 0..1. */
  focusX: number;
  focusY: number;
}

/** Punto normalizado del plano del campo (0..1 en cada eje). */
export interface NormalizedPoint {
  x: number;
  y: number;
}

export const CAMERA_MODES: {
  id: PitchCameraMode;
  label: string;
  short: string;
}[] = [
  { id: "broadcast", label: "Retransmisión (TV)", short: "TV" },
  { id: "top", label: "Cenital · campo plano", short: "Top" },
  { id: "goal", label: "Desde portería", short: "Portería" },
  { id: "follow", label: "Seguir la jugada", short: "Seguir" },
  { id: "jugador", label: "Vista de jugador", short: "Jugador" },
];

const PRESETS: Record<PitchCameraMode, CameraPose> = {
  /*
   * El encuadre de televisión no enseña sólo el campo: enseña el campo **con
   * el estadio detrás**. Antes el zoom era 1.16 y de todo lo que se levanta
   * alrededor (los dos anillos LED, la grada, la cubierta) sólo asomaba una
   * franja azul de tres píxeles pegada al borde de arriba. Abrir el plano
   * hasta 0.82 mete el fondo entero en cuadro y el campo sigue llenando el
   * ancho: es el plano general con el que arranca cualquier retransmisión.
   */
  broadcast: {
    tilt: 44,
    yaw: 0,
    zoom: 0.82,
    panX: 0,
    panY: 8,
    focusX: 0.5,
    focusY: 0.5,
  },
  top: { tilt: 0, yaw: 0, zoom: 1, panX: 0, panY: 0, focusX: 0.5, focusY: 0.5 },
  /*
   * Cámara de fondo: el giro es +90 para que la portería derecha caiga cerca
   * del observador y el campo se pierda hacia el horizonte. Con -90 se vería
   * desde el centro del campo hacia la portería, que no es lo mismo.
   */
  goal: {
    tilt: 66,
    yaw: 90,
    zoom: 1.15,
    panX: 0,
    panY: 26,
    focusX: 0.74,
    focusY: 0.5,
  },
  follow: {
    tilt: 38,
    yaw: 0,
    zoom: 1.7,
    panX: 0,
    panY: -12,
    focusX: 0.5,
    focusY: 0.5,
  },
  /*
   * Vista de jugador: la cámara baja casi al césped y mira lo que ve alguien
   * que está dentro de la jugada. Es la que explica por qué un pase no existe
   * —un cuerpo tapa la línea— cuando desde arriba parecía obvio. El giro es
   * ligero, no cenital: mirar completamente de canto aplasta el campo hasta
   * dejarlo en una raya.
   */
  jugador: {
    tilt: 77,
    yaw: -8,
    zoom: 2.5,
    panX: 0,
    panY: 128,
    focusX: 0.5,
    focusY: 0.56,
  },
};

/** Modo que se recupera al volver a encender la perspectiva. */
const DEFAULT_3D_MODE: PitchCameraMode = "broadcast";

export const TILT_MIN = 0;
export const TILT_MAX = 86;
export const ZOOM_MIN = 0.55;
export const ZOOM_MAX = 3.4;

/** Tope del desplazamiento, como fracción del contenedor. Evita perder el campo. */
const PAN_LIMIT = 0.62;

/** Distancia del observador, como múltiplo del ancho del contenedor. */
const PERSPECTIVE_RATIO = 1.35;

/** Constante de tiempo del suavizado, en milisegundos. */
const EASE_MS = 190;

/** Grados de giro y de inclinación por píxel arrastrado. */
const ORBIT_YAW_SPEED = 0.32;
const ORBIT_TILT_SPEED = 0.28;

// ---------------------------------------------------------------
// Matrices 4x4 en orden por columnas, como espera `matrix3d`
// ---------------------------------------------------------------

type Mat4 = number[];

const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);

  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;

      for (let k = 0; k < 4; k += 1) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }

      out[col * 4 + row] = sum;
    }
  }

  return out;
}

function translation(x: number, y: number, z = 0): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}

function scaling(s: number): Mat4 {
  return [s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function rotationX(deg: number): Mat4 {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);

  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}

function rotationZ(deg: number): Mat4 {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);

  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

/**
 * Matriz del plano para una postura y un tamaño de contenedor dados.
 *
 * El origen de transformación es el centro, así que trabaja con coordenadas
 * centradas: primero se lleva el punto de foco al centro, luego se gira, se
 * inclina, se escala y por último se desplaza.
 */
function poseMatrix(pose: CameraPose, width: number, height: number): Mat4 {
  const focusDx = -(pose.focusX - 0.5) * width;
  const focusDy = -(pose.focusY - 0.5) * height;

  return [
    translation(pose.panX, pose.panY),
    scaling(pose.zoom),
    rotationX(pose.tilt),
    rotationZ(pose.yaw),
    translation(focusDx, focusDy),
  ].reduce(multiply, IDENTITY);
}

function matrixToCss(matrix: Mat4) {
  return `matrix3d(${matrix
    .map((value) => Number(value.toFixed(6)))
    .join(",")})`;
}

// ---------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Diferencia de ángulos por el camino corto, para que no gire de más. */
function shortestDelta(from: number, to: number) {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

function samePose(a: CameraPose, b: CameraPose) {
  return (
    Math.abs(a.tilt - b.tilt) < 0.02 &&
    Math.abs(shortestDelta(a.yaw, b.yaw)) < 0.02 &&
    Math.abs(a.zoom - b.zoom) < 0.0008 &&
    Math.abs(a.panX - b.panX) < 0.05 &&
    Math.abs(a.panY - b.panY) < 0.05 &&
    Math.abs(a.focusX - b.focusX) < 0.0004 &&
    Math.abs(a.focusY - b.focusY) < 0.0004
  );
}

/**
 * Profundidad de un punto del plano, ya girado e inclinado.
 *
 * Sirve para pintar primero lo que queda lejos. Solo depende de la postura,
 * así que se calcula una vez por render y se aplica a todas las fichas.
 */
export function planeDepth(
  pose: CameraPose,
  x: number,
  y: number
): number {
  const yaw = (pose.yaw * Math.PI) / 180;
  const tilt = (pose.tilt * Math.PI) / 180;

  return Math.sin(tilt) * (Math.sin(yaw) * x + Math.cos(yaw) * y);
}

// ---------------------------------------------------------------
// Hook
// ---------------------------------------------------------------

/** Qué hace el arrastre en curso. */
type GestureKind = "orbit" | "pan";

type Gesture =
  | { kind: GestureKind; id: number; x: number; y: number }
  | { kind: "pinch"; distance: number; cx: number; cy: number };

export interface UsePitchCameraOptions {
  /** Modo con el que arranca la pizarra. */
  initialMode?: PitchCameraMode;
  initialRender?: PitchRender;
  /** Punto que persigue el modo «Seguir», normalizado. */
  followTarget?: NormalizedPoint | null;
  /** Devuelve la cámara a reposo mientras se exporta la imagen. */
  neutral?: boolean;
}

export interface PitchCamera {
  mode: PitchCameraMode;
  setMode: (mode: PitchCameraMode) => void;
  render: PitchRender;
  setRender: (render: PitchRender) => void;

  /** Postura de destino. Sirve para los indicadores de la barra. */
  pose: CameraPose;
  /** `true` mientras el usuario arrastra la cámara. */
  navigating: boolean;
  /** `true` si la postura se ha tocado a mano respecto al preajuste. */
  adjusted: boolean;

  /**
   * Refs de callback para el contenedor con perspectiva y el plano del campo.
   *
   * Se exponen como funciones y no como objetos `ref` a propósito: así el
   * escenario puede engancharlas sin tocar refs durante el render.
   */
  attachContainer: (node: HTMLDivElement | null) => void;
  attachPlane: (node: HTMLDivElement | null) => void;
  containerStyle: CSSProperties;
  planeStyle: CSSProperties;

  orbitBy: (deltaYaw: number, deltaTilt: number) => void;
  panBy: (deltaX: number, deltaY: number) => void;
  /** El ancla mantiene fijo el punto del campo que hay bajo el cursor. */
  zoomBy: (factor: number, anchor?: ScreenAnchor) => void;
  setTilt: (tilt: number) => void;
  setYaw: (yaw: number) => void;
  reset: () => void;

  /** Punto del plano bajo el cursor, en 0..1. `null` si aún no hay medidas. */
  unproject: (clientX: number, clientY: number) => NormalizedPoint | null;

  /**
   * Arranca un arrastre de cámara desde cualquier sitio.
   *
   * Lo usa tanto la capa de navegación como los atajos que funcionan con
   * otra herramienta activa (botón central, Alt, dos dedos). El seguimiento
   * se hace en `window`, así que basta con llamar aquí una vez.
   */
  beginNavigation: (pointer: PointerSample, kind: GestureKind) => void;

  /**
   * Handlers para la capa de navegación que cubre el campo.
   *
   * La rueda no está aquí: React escucha `wheel` en modo pasivo y no dejaría
   * cancelar el desplazamiento de la página. El escenario la engancha a mano.
   */
  navigationHandlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  };
}

export function usePitchCamera(
  options: UsePitchCameraOptions = {}
): PitchCamera {
  const {
    initialMode = "top",
    initialRender = "2d",
    followTarget = null,
    neutral = false,
  } = options;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const planeRef = useRef<HTMLDivElement | null>(null);

  /** El contenedor también en estado, para poder observar su tamaño. */
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  const attachContainer = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setContainer(node);
  }, []);

  const attachPlane = useCallback((node: HTMLDivElement | null) => {
    planeRef.current = node;
  }, []);

  const [mode, setModeState] = useState<PitchCameraMode>(initialMode);
  const [render, setRenderState] = useState<PitchRender>(initialRender);
  const [navigating, setNavigating] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });

  /** Postura a la que se quiere llegar. */
  const targetRef = useRef<CameraPose>({ ...PRESETS[initialMode] });
  /** Postura pintada ahora mismo. */
  const poseRef = useRef<CameraPose>({ ...PRESETS[initialMode] });

  /** Copia en estado, solo para que la barra superior se repinte. */
  const [pose, setPose] = useState<CameraPose>(() => ({ ...PRESETS[initialMode] }));
  const [adjusted, setAdjusted] = useState(false);

  /**
   * Copias que lee el bucle de animación, que corre fuera de React.
   *
   * Se sincronizan en un efecto, nunca durante el render.
   */
  const sizeRef = useRef(size);
  const renderRef = useRef(render);
  const neutralRef = useRef(neutral);

  // -------------------------------------------------------------
  // Medidas del contenedor
  // -------------------------------------------------------------

  useEffect(() => {
    const element = container;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();

      setSize((current) =>
        Math.abs(current.width - rect.width) < 0.5 &&
        Math.abs(current.height - rect.height) < 0.5
          ? current
          : { width: rect.width, height: rect.height }
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [container]);

  // -------------------------------------------------------------
  // Postura efectiva: en 2D no hay inclinación
  // -------------------------------------------------------------

  const effective = useCallback((raw: CameraPose): CameraPose => {
    if (neutralRef.current) return { ...PRESETS.top };

    return renderRef.current === "2d" ? { ...raw, tilt: 0 } : raw;
  }, []);

  /** Escribe la matriz en el DOM sin pasar por un render de React. */
  const paint = useCallback(
    (raw: CameraPose) => {
      const plane = planeRef.current;
      if (!plane) return;

      const { width, height } = sizeRef.current;
      if (width === 0 || height === 0) return;

      plane.style.transform = matrixToCss(
        poseMatrix(effective(raw), width, height)
      );
    },
    [effective]
  );

  // -------------------------------------------------------------
  // Suavizado
  // -------------------------------------------------------------

  const frameRef = useRef(0);
  const runningRef = useRef(false);

  const tick = useCallback(() => {
    let last = 0;

    const step = (time: number) => {
      const dt = last === 0 ? 16 : Math.min(64, time - last);
      last = time;

      const current = poseRef.current;
      const target = targetRef.current;

      // Interpolación independiente de los fps: cuanto más lejos, más rápido.
      const k = 1 - Math.exp(-dt / EASE_MS);

      const next: CameraPose = {
        tilt: current.tilt + (target.tilt - current.tilt) * k,
        yaw: current.yaw + shortestDelta(current.yaw, target.yaw) * k,
        zoom: current.zoom + (target.zoom - current.zoom) * k,
        panX: current.panX + (target.panX - current.panX) * k,
        panY: current.panY + (target.panY - current.panY) * k,
        focusX: current.focusX + (target.focusX - current.focusX) * k,
        focusY: current.focusY + (target.focusY - current.focusY) * k,
      };

      const done = samePose(next, target);
      poseRef.current = done ? { ...target } : next;

      paint(poseRef.current);

      if (done) {
        runningRef.current = false;
        return;
      }

      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
  }, [paint]);

  const retarget = useCallback(
    (updater: (current: CameraPose) => CameraPose) => {
      targetRef.current = updater(targetRef.current);

      // Refresca los indicadores de la barra sin esperar al final del viaje.
      setPose({ ...targetRef.current });

      if (runningRef.current) return;

      runningRef.current = true;
      tick();
    },
    [tick]
  );

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  /**
   * Pone al día lo que lee el bucle y repinta.
   *
   * Va todo en el mismo efecto para que la matriz nueva se calcule siempre
   * con el tamaño y el modo que acaban de entrar.
   */
  useEffect(() => {
    sizeRef.current = size;
    renderRef.current = render;
    neutralRef.current = neutral;

    paint(poseRef.current);
  }, [paint, size, render, neutral]);

  // -------------------------------------------------------------
  // Modos
  // -------------------------------------------------------------

  /**
   * Cambia el modo y, con él, la perspectiva.
   *
   * Cenital es una vista plana y las otras tres solo se entienden con
   * perspectiva. Antes había que acertar con dos botones distintos —elegir
   * «Portería» con el campo en 2D no movía nada—, así que ahora el modo
   * decide y el interruptor 2D/3D queda como matiz.
   */
  const setMode = useCallback(
    (next: PitchCameraMode) => {
      setModeState(next);
      setAdjusted(false);

      const wanted: PitchRender = next === "top" ? "2d" : "3d";
      setRenderState(wanted);
      renderRef.current = wanted;

      const preset = PRESETS[next];

      retarget((current) =>
        next === "follow"
          ? {
              // El foco lo pone el efecto de seguimiento; no saltes al centro.
              ...preset,
              focusX: current.focusX,
              focusY: current.focusY,
            }
          : { ...preset }
      );
    },
    [retarget]
  );

  const setRender = useCallback(
    (next: PitchRender) => {
      setRenderState(next);
      renderRef.current = next;

      // Encender la perspectiva desde la cenital dejaba el campo igual de
      // plano: no hay inclinación que enseñar. Se sale a retransmisión.
      if (next === "3d" && mode === "top") {
        setModeState(DEFAULT_3D_MODE);
        setAdjusted(false);
        retarget(() => ({ ...PRESETS[DEFAULT_3D_MODE] }));
      }
    },
    [mode, retarget]
  );

  // -------------------------------------------------------------
  // Seguimiento del balón o del jugador
  // -------------------------------------------------------------

  const followX = followTarget?.x ?? null;
  const followY = followTarget?.y ?? null;

  useEffect(() => {
    if (mode !== "follow" || followX === null || followY === null) return;

    retarget((current) => ({
      ...current,
      focusX: clamp(followX, 0, 1),
      focusY: clamp(followY, 0, 1),
    }));
  }, [mode, followX, followY, retarget]);

  // -------------------------------------------------------------
  // Controles manuales
  // -------------------------------------------------------------

  const touch = useCallback(() => setAdjusted(true), []);

  /** Mantiene el campo a la vista por muy lejos que se arrastre. */
  const clampPan = useCallback((next: CameraPose): CameraPose => {
    const { width, height } = sizeRef.current;
    if (width === 0 || height === 0) return next;

    return {
      ...next,
      panX: clamp(next.panX, -width * PAN_LIMIT, width * PAN_LIMIT),
      panY: clamp(next.panY, -height * PAN_LIMIT, height * PAN_LIMIT),
    };
  }, []);

  const orbitBy = useCallback(
    (deltaYaw: number, deltaTilt: number) => {
      touch();

      retarget((current) => ({
        ...current,
        yaw: current.yaw + deltaYaw,
        tilt: clamp(current.tilt + deltaTilt, TILT_MIN, TILT_MAX),
      }));
    },
    [retarget, touch]
  );

  const panBy = useCallback(
    (deltaX: number, deltaY: number) => {
      touch();

      retarget((current) =>
        clampPan({
          ...current,
          panX: current.panX + deltaX,
          panY: current.panY + deltaY,
        })
      );
    },
    [clampPan, retarget, touch]
  );

  /**
   * Zoom, opcionalmente anclado a un punto de la pantalla.
   *
   * Con ancla, el trozo de campo que hay bajo el cursor se queda quieto: es
   * lo que espera cualquiera que use la rueda para acercarse a un detalle.
   * Sin ella se acerca al centro, como antes.
   */
  const zoomBy = useCallback(
    (factor: number, anchor?: ScreenAnchor) => {
      touch();

      retarget((current) => {
        const zoom = clamp(current.zoom * factor, ZOOM_MIN, ZOOM_MAX);
        const ratio = zoom / current.zoom;

        const element = containerRef.current;
        if (!anchor || !element || Math.abs(ratio - 1) < 1e-6) {
          return { ...current, zoom };
        }

        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return { ...current, zoom };

        // El punto se proyecta en  pantalla = pan + zoom · plano. Manteniendo
        // «plano» fijo y despejando el pan nuevo sale esta interpolación.
        const sx = anchor.clientX - rect.left - rect.width / 2;
        const sy = anchor.clientY - rect.top - rect.height / 2;

        return clampPan({
          ...current,
          zoom,
          panX: sx * (1 - ratio) + ratio * current.panX,
          panY: sy * (1 - ratio) + ratio * current.panY,
        });
      });
    },
    [clampPan, retarget, touch]
  );

  const setTilt = useCallback(
    (tilt: number) => {
      touch();

      retarget((current) => ({
        ...current,
        tilt: clamp(tilt, TILT_MIN, TILT_MAX),
      }));
    },
    [retarget, touch]
  );

  const setYaw = useCallback(
    (yaw: number) => {
      touch();
      retarget((current) => ({ ...current, yaw }));
    },
    [retarget, touch]
  );

  const reset = useCallback(() => {
    setAdjusted(false);
    retarget(() => ({ ...PRESETS[mode] }));
  }, [mode, retarget]);

  // -------------------------------------------------------------
  // Des-proyección: del cursor al plano del campo
  // -------------------------------------------------------------

  const unproject = useCallback(
    (clientX: number, clientY: number): NormalizedPoint | null => {
      const element = containerRef.current;
      if (!element) return null;

      const rect = element.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width === 0 || height === 0) return null;

      const matrix = poseMatrix(effective(poseRef.current), width, height);

      // Columnas de la matriz: ejes del plano y traslación.
      const ax = matrix[0];
      const ay = matrix[1];
      const az = matrix[2];
      const bx = matrix[4];
      const by = matrix[5];
      const bz = matrix[6];
      const tx = matrix[12];
      const ty = matrix[13];
      const tz = matrix[14];

      // Coordenadas del cursor respecto al centro, que es a la vez el origen
      // de la perspectiva y el de la transformación.
      const X = clientX - rect.left - width / 2;
      const Y = clientY - rect.top - height / 2;

      // Sin perspectiva la división por P desaparece: se usa un valor enorme.
      const P =
        renderRef.current === "3d" && !neutralRef.current
          ? width * PERSPECTIVE_RATIO
          : 1e9;

      // El punto proyectado cumple  w.xy = pantalla · (1 - w.z / P).
      // Sustituyendo w = a·u + b·v + t queda un sistema lineal de 2x2.
      const a11 = ax + (X * az) / P;
      const a12 = bx + (X * bz) / P;
      const a21 = ay + (Y * az) / P;
      const a22 = by + (Y * bz) / P;

      const c1 = X * (1 - tz / P) - tx;
      const c2 = Y * (1 - tz / P) - ty;

      const det = a11 * a22 - a12 * a21;
      if (Math.abs(det) < 1e-9) return null;

      const u = (c1 * a22 - c2 * a12) / det;
      const v = (a11 * c2 - a21 * c1) / det;

      return { x: (u + width / 2) / width, y: (v + height / 2) / height };
    },
    [effective]
  );

  // -------------------------------------------------------------
  // Navegación con el ratón y con los dedos
  // -------------------------------------------------------------

  /** Punteros que ahora mismo están moviendo la cámara. */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<Gesture | null>(null);

  const beginNavigation = useCallback(
    (pointer: PointerSample, kind: GestureKind) => {
      const pointers = pointersRef.current;

      pointers.set(pointer.pointerId, {
        x: pointer.clientX,
        y: pointer.clientY,
      });

      const active = [...pointers.values()];

      if (active.length >= 2) {
        // Dos dedos: pellizcar para el zoom y arrastrar para desplazar.
        const [a, b] = active.slice(-2);

        gestureRef.current = {
          kind: "pinch",
          distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          cx: (a.x + b.x) / 2,
          cy: (a.y + b.y) / 2,
        };
      } else {
        gestureRef.current = {
          kind,
          id: pointer.pointerId,
          x: pointer.clientX,
          y: pointer.clientY,
        };
      }

      setNavigating(true);
    },
    []
  );

  /*
   * El seguimiento vive en `window` para que el gesto no se corte al salir
   * del campo y para que dé igual desde qué capa se haya empezado.
   */
  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const pointers = pointersRef.current;
      if (!pointers.has(event.pointerId)) return;

      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      const gesture = gestureRef.current;
      if (!gesture) return;

      if (gesture.kind === "pinch") {
        const [a, b] = [...pointers.values()];
        if (!a || !b) return;

        const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;

        zoomBy(distance / gesture.distance, { clientX: cx, clientY: cy });
        panBy(cx - gesture.cx, cy - gesture.cy);

        gesture.distance = distance;
        gesture.cx = cx;
        gesture.cy = cy;
        return;
      }

      if (gesture.id !== event.pointerId) return;

      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;

      gesture.x = event.clientX;
      gesture.y = event.clientY;

      if (gesture.kind === "pan") {
        panBy(dx, dy);
        return;
      }

      // Horizontal gira el campo; vertical lo inclina.
      orbitBy(dx * ORBIT_YAW_SPEED, -dy * ORBIT_TILT_SPEED);
    };

    const handleUp = (event: PointerEvent) => {
      const pointers = pointersRef.current;
      if (!pointers.delete(event.pointerId)) return;

      // Al levantar un dedo del pellizco, el que queda sigue desplazando.
      if (gestureRef.current?.kind === "pinch" && pointers.size === 1) {
        const [id] = [...pointers.keys()];
        const point = pointers.get(id);

        if (point) {
          gestureRef.current = { kind: "pan", id, x: point.x, y: point.y };
          return;
        }
      }

      if (pointers.size > 0) return;

      gestureRef.current = null;
      setNavigating(false);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [orbitBy, panBy, zoomBy]);

  const navigationHandlers = useMemo(
    () => ({
      onPointerDown(event: ReactPointerEvent<HTMLElement>) {
        // Botón central o derecho, o con Mayús: paneo. El resto, órbita.
        const kind =
          event.button === 0 && !event.shiftKey
            ? ("orbit" as const)
            : ("pan" as const);

        event.preventDefault();
        beginNavigation(event.nativeEvent, kind);
      },

      onContextMenu(event: ReactMouseEvent<HTMLElement>) {
        event.preventDefault();
      },
    }),
    [beginNavigation]
  );

  // -------------------------------------------------------------
  // Estilos
  // -------------------------------------------------------------

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      perspective:
        render === "3d" && !neutral && size.width > 0
          ? `${Math.round(size.width * PERSPECTIVE_RATIO)}px`
          : "none",
      perspectiveOrigin: "50% 50%",
    }),
    [render, neutral, size.width]
  );

  const planeStyle = useMemo<CSSProperties>(
    () => ({
      transformOrigin: "50% 50%",
      transformStyle: "preserve-3d",
      willChange: "transform",
    }),
    []
  );

  return {
    mode,
    setMode,
    render,
    setRender,
    pose,
    navigating,
    adjusted,
    attachContainer,
    attachPlane,
    containerStyle,
    planeStyle,
    orbitBy,
    panBy,
    zoomBy,
    setTilt,
    setYaw,
    reset,
    unproject,
    beginNavigation,
    navigationHandlers,
  };
}
