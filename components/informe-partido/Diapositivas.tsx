"use client";

/**
 * EL RESUMEN DEL PARTIDO EN TRES DIAPOSITIVAS (03/10/2026; la tercera, 06/10/2026).
 *
 * Lo que se lee en el móvil antes de entrar al vestuario: dos láminas de
 * 1920×1080, iguales en pantalla, en el correo y en el PDF.
 *
 *   PREVIA (23/10/2026, del rival a cómo lo ganamos, en una sola historia):
 *     1 «El rival»: la pregunta del partido, cómo juegan, de un vistazo y su once.
 *     2 «Dónde está el partido»: dónde nos separamos, el pronóstico (en
 *        pequeño) y los duelos.
 *     3 «Cómo lo ganamos»: la idea, el plan por fases con su tarea de la
 *        semana, a vigilar, el balón parado y, al pie, la consigna.
 *   POST   · 1 «El resultado»: marcador y el partido en datos, nosotros y ellos.
 *   POST   · 2 «Lo que nos deja»: lo que se salió de lo habitual, el plan a
 *               revisión y la semana que lo preparó.
 *   LAS DOS · 3 «Duelos y rival»: dónde les hacemos daño con balón y dónde
 *               nos lo pueden hacer sin él (Competición → Duelos), y el rival
 *               de un vistazo (DATA).
 *
 * Todo en estilos en línea (hex y rgba): `html-to-image` serializa el estilo
 * calculado y ni `oklch` ni `backdrop-filter` sobreviven al JPEG.
 */

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

import {
  apellido,
  cifra,
  claveDeFase,
  claveEnCorto,
  metaDeClave,
  conDato,
  cortaEnPausa,
  duelosDeLaLamina,
  fraseUtil,
  lecturaXg,
  minutosAbpInforme,
  minutosLegibles,
  metricasQueSeparan,
  ordinal,
  pct,
  REGLA_VEREDICTO,
  nombreMetricaPartido,
  unidadPartido,
  selloDatos,
  sinSiglas,
  ventajaVisible,
  conductaDuelo,
  fraseFrenados,
  cifrasDuelo,
  type DueloJugadores,
  type GolCronica,
  type InformePartido,
  type JugadorRival,
  type MetricaDuelo,
  type Probabilidades,
  quienDuelo,
} from "@/lib/informe-partido/modelo";

/**
 * Las siglas que salen en una lámina, explicadas en su pie (20/10/2026): un
 * entrenador no tiene por qué saber qué es «xG» o «PPDA».
 */
function glosario(textos: string[]) {
  const t = textos.join(" ");

  return [
    /\bxG\b/i.test(t) ? "xG = goles esperados" : "",
    /\bPPDA\b/.test(t) ? "PPDA = pases que dejan dar antes de presionar (menos = más presión)" : "",
    /\bABP\b/.test(t) ? "ABP = balón parado" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export const DIAPO_W = 1920;
export const DIAPO_H = 1080;

const C = {
  fondo: "#08111F",
  panel: "rgba(255,255,255,0.045)",
  borde: "rgba(255,255,255,0.09)",
  oro: "#C8A96B",
  oroClaro: "#E4CE9B",
  crema: "#F7F4EC",
  suave: "rgba(247,244,236,0.62)",
  tenue: "rgba(247,244,236,0.38)",
  rival: "#E86A5A",
  bien: "#3FBF8A",
  mal: "#E8615A",
  neutro: "#9CA3AF",
};

const fuente: CSSProperties = { fontFamily: "var(--fuente-informe, 'Barlow Condensed', Arial, sans-serif)" };

/*
| Lo que no cabe se corta en una pausa natural y sin «…» (21/10/2026): «2
| goles encajad…» o «el otro de 3º…» se leían como un error. Los topes son
| de varias líneas: el texto envuelve; sólo se corta lo que no cabría.
*/
const recorta = cortaEnPausa;

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

function Marco({ children, pagina, total, etiqueta, inf }: { children: ReactNode; pagina: number; total: number; etiqueta: string; inf: InformePartido }) {
  const p = inf.partido;

  /*
  | La cabecera dice contra quién en las tres láminas (21/10/2026): la 2 y la
  | 3, reenviadas sueltas por WhatsApp, no decían de qué partido eran, y
  | «MICROCICLO 18» ocupaba el sitio del rival. El micro va al final, pequeño.
  */
  const post = inf.momento === "post";

  /* En el post, el marcador como se lee: el de casa primero. */
  const partido =
    post && p.gf !== null && p.gc !== null
      ? p.lado === "fuera"
        ? `${p.rival.toUpperCase()} ${p.gc}-${p.gf} RM CASTILLA`
        : `RM CASTILLA ${p.gf}-${p.gc} ${p.rival.toUpperCase()}`
      : p.rival.toUpperCase();

  const cabecera = [post ? "POST" : "PREVIA", p.jornada ? `J${p.jornada}` : "", partido, !post && p.lado ? (p.lado === "fuera" ? "FUERA" : "EN CASA") : ""].filter(Boolean).join(" · ");

  return (
    <div
      data-diapositiva-partido
      style={{
        ...fuente,
        width: DIAPO_W,
        height: DIAPO_H,
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        padding: "46px 60px 40px",
        color: C.crema,
        background: `radial-gradient(1100px 620px at 92% -8%, rgba(200,169,107,0.16), rgba(0,0,0,0) 60%), radial-gradient(900px 600px at -10% 110%, rgba(23,48,79,0.9), rgba(0,0,0,0) 60%), linear-gradient(180deg, #0C1A2E 0%, ${C.fondo} 100%)`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Cabecera */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" style={{ width: 54, height: 54, objectFit: "contain" }} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.26em", color: C.oro }}>REAL MADRID CASTILLA</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.14em", color: C.crema }}>{cabecera}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "0.08em", color: C.suave, textTransform: "uppercase" }}>
            {p.fechaTexto}
            {inf.microciclo ? <span style={{ fontSize: 16, color: C.tenue }}> · MICRO {inf.microciclo.micro}</span> : null}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.2em", color: C.oro }}>
            {etiqueta} · {pagina}/{total}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, height: 3, background: `linear-gradient(90deg, ${C.oro}, rgba(200,169,107,0.1) 75%, rgba(200,169,107,0))` }} />

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", marginTop: 22 }}>{children}</div>
    </div>
  );
}

function Panel({ titulo, children, style, acento = C.oro }: { titulo: string; children: ReactNode; style?: CSSProperties; acento?: string }) {
  return (
    <div
      style={{
        background: C.panel,
        border: `2px solid ${C.borde}`,
        borderRadius: 26,
        padding: "22px 28px",
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span style={{ width: 8, height: 26, borderRadius: 4, background: acento }} />
        <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.18em", color: C.crema }}>{titulo}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}

function Escudo({ src, size }: { src: string; size: number }) {
  return src ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={`/api/rivals/foto?url=${encodeURIComponent(src)}`} alt="" style={{ width: size, height: size, objectFit: "contain" }} />
  ) : (
    <span style={{ width: size, height: size, borderRadius: 999, background: "rgba(255,255,255,0.08)" }} />
  );
}

/** «G», «E», «P» de la forma de Wyscout, por si BeSoccer no trae la racha. */
const deForma = (lista: { gf: number; gc: number }[] | undefined) => (lista ?? []).map((p) => (p.gf > p.gc ? "G" : p.gf < p.gc ? "P" : "E"));

function Forma({ titulo, resultados, derecha = false }: { titulo: string; resultados: string[]; derecha?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexDirection: derecha ? "row-reverse" : "row" }}>
      <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.16em", color: C.tenue, textAlign: derecha ? "left" : "right", whiteSpace: "nowrap" }}>
        {titulo}
        <br />
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.08em" }}>{derecha ? "← RECIENTE" : "RECIENTE →"}</span>
      </span>
      {resultados.slice(0, 5).map((r, i) => {
        return (
          <span
            key={i}
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 700,
              color: "#08111F",
              background: r === "G" ? C.bien : r === "P" ? C.mal : C.neutro,
            }}
          >
            {r}
          </span>
        );
      })}
    </div>
  );
}

/** Una métrica, nosotros a la izquierda y ellos a la derecha, por percentil. */
function FilaDuelo({ m, equipos, compacta = false }: { m: MetricaDuelo; equipos: number; compacta?: boolean }) {
  const ancho = compacta ? 150 : 290;

  const numero = compacta ? 108 : 138;

  const lado = (dato: MetricaDuelo["nosotros"], color: string, alinear: "left" | "right") => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexDirection: alinear === "left" ? "row-reverse" : "row", width: ancho + numero + 12 }}>
      <div style={{ width: ancho, height: compacta ? 16 : 22, borderRadius: 11, background: "rgba(255,255,255,0.06)", position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            [alinear === "left" ? "right" : "left"]: 0,
            width: `${Math.max(4, dato?.percentil ?? 0)}%`,
            background: color,
            borderRadius: 11,
          }}
        />
      </div>
      <div style={{ width: numero, textAlign: alinear === "left" ? "right" : "left", whiteSpace: "nowrap" }}>
        <span style={{ fontSize: compacta ? 24 : 30, fontWeight: 700, color: C.crema }}>{cifra(dato?.valor ?? null, m.unidad)}</span>
        <span style={{ fontSize: compacta ? 15 : 19, fontWeight: 600, color: C.tenue, marginLeft: 5, marginRight: 5 }}>{dato ? ordinal(dato.puesto) : ""}</span>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      {lado(m.nosotros, C.oro, "left")}
      <div style={{ flex: 1, textAlign: "center", fontSize: compacta ? 16 : 22, lineHeight: 1.05, fontWeight: 700, letterSpacing: "0.04em", color: C.suave, textTransform: "uppercase" }}>
        {sinSiglas(m.nombre)}
      </div>
      {lado(m.rival, C.rival, "right")}
      <span style={{ display: "none" }}>{equipos}</span>
    </div>
  );
}

/**
 * El once en un campo vertical: su portería abajo. Mide lo que le deje el
 * panel (con la proporción de un campo) y coloca en tanto por ciento: con un
 * alto fijo, un panel más bajo lo encogía y se comía al portero.
 */
function Campo({ once, resaltar }: { once: JugadorRival[]; resaltar?: Set<string> }) {
  const linea = "2px solid rgba(255,255,255,0.22)";

  /* Las fichas, a la medida del campo (24/10/2026): en el post el campo es más pequeño y las cuatro de la defensa se pisaban. */
  const caja = useRef<HTMLDivElement>(null);

  const [escala, setEscala] = useState(1);

  useEffect(() => {
    const el = caja.current;

    if (!el) return;

    const mide = () => setEscala(Math.max(0.6, Math.min(1, el.offsetWidth / 540)));

    mide();

    const ro = new ResizeObserver(mide);

    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  return (
    <div ref={caja} style={{ position: "relative", flex: 1, minHeight: 0, height: "100%", aspectRatio: "1.12", maxWidth: "100%", margin: "0 auto", borderRadius: 18, overflow: "hidden", background: "repeating-linear-gradient(180deg, #133A27 0 10%, #10301F 10% 20%)", border: "2px solid rgba(255,255,255,0.12)" }}>
      {/* líneas */}
      <div style={{ position: "absolute", left: "4%", right: "4%", top: "3%", bottom: "3%", border: linea, borderRadius: 4 }} />
      <div style={{ position: "absolute", left: "4%", right: "4%", top: "50%", height: 2, background: "rgba(255,255,255,0.22)" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", width: "24%", aspectRatio: "1", transform: "translate(-50%, -50%)", borderRadius: 999, border: linea }} />
      <div style={{ position: "absolute", left: "27%", right: "27%", bottom: "3%", height: "15%", border: linea, borderBottom: "none" }} />
      <div style={{ position: "absolute", left: "27%", right: "27%", top: "3%", height: "15%", border: linea, borderTop: "none" }} />

      {once.map((j) => {
        const x = 7 + (j.x ?? 0.5) * 86;
        const y = 92 - (j.y ?? 0.5) * 84;

        return (
          <div key={j.clave} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: Math.round(118 * escala), transform: `translate(-50%, -${Math.round(30 * escala)}px)`, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Cara j={j} size={Math.round(54 * escala)} color={resaltar?.has(j.clave) ? C.oro : C.rival} />
            </div>
            <div style={{ marginTop: 3, fontSize: Math.max(13, Math.round(18 * escala)), fontWeight: 700, color: "#fff", textTransform: "uppercase", textShadow: "0 1px 3px rgba(0,0,0,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {j.nombre.split(" ").slice(-1)[0]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** La cara del jugador (por el proxy de fotos), con el dorsal en una chapa. Sin foto, el dorsal. */
function Cara({ j, size, color = C.rival }: { j: JugadorRival; size: number; color?: string }) {
  const src = j.foto ? `/api/rivals/foto?url=${encodeURIComponent(j.foto)}` : "";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          overflow: "hidden",
          boxSizing: "border-box",
          border: `3px solid ${color}`,
          background: src ? "#E9E4D8" : color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: size * 0.42,
          fontWeight: 700,
        }}
      >
        {src ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
        ) : (
          j.dorsal || "·"
        )}
      </div>
      {src && j.dorsal ? (
        <span
          style={{
            position: "absolute",
            right: -6,
            bottom: -4,
            minWidth: size * 0.44,
            height: size * 0.44,
            padding: "0 4px",
            boxSizing: "border-box",
            borderRadius: 999,
            background: color,
            border: "2px solid #0C1A2E",
            color: "#fff",
            fontSize: size * 0.26,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {j.dorsal}
        </span>
      ) : null}
    </div>
  );
}

function Lista({ items, numerada = false, tamano = 30, max = 4, corte = 120 }: { items: string[]; numerada?: boolean; tamano?: number; max?: number; corte?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: tamano * 0.6 }}>
      {items.slice(0, max).map((t, i) => (
        <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {numerada ? (
            <span style={{ minWidth: tamano * 1.5, height: tamano * 1.5, borderRadius: 12, background: C.oro, color: "#08111F", fontSize: tamano, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
          ) : (
            <span style={{ marginTop: tamano * 0.45, minWidth: 10, height: 10, borderRadius: 99, background: C.oro }} />
          )}
          <span style={{ fontSize: tamano, fontWeight: 600, lineHeight: 1.15, color: C.crema }}>{recorta(t, corte)}</span>
        </div>
      ))}
    </div>
  );
}

function Semana({ inf }: { inf: InformePartido }) {
  const m = inf.microciclo;

  /* Sin tareas, nada: el informe no nombra lo que no tiene (antes, «Sin tareas en la hoja de registro»). */
  if (!m) return null;

  /*
  | Lo planificado, no ceros (20/10/2026). Una previa de lunes enseñaba
  | «0′ · 0′ · 0′ · 0′ · 90′»: no es una medida, es que la hoja aún no tiene
  | los minutos. Mientras ningún día de trabajo tenga minutos, salen los
  | días con sus tareas y contenidos, rotulados «planificado».
  */
  const registrado = m.dias.some((d) => !d.esPartido && d.minutos > 0);

  if (!registrado) {
    const dias = m.dias.filter((d) => !d.esPartido && (d.tareas > 0 || d.contenidos.length));

    if (!dias.length) return null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.tenue }}>PLANIFICADO</div>
        {dias.slice(0, 5).map((d) => (
          <div key={d.fecha} style={{ display: "flex", gap: 12, alignItems: "baseline", fontSize: 20, fontWeight: 600, lineHeight: 1.15 }}>
            <span style={{ width: 70, flexShrink: 0, color: C.oro, fontWeight: 700 }}>{d.md || d.etiqueta}</span>
            <span style={{ width: 74, flexShrink: 0, color: C.tenue, fontSize: 17 }}>{d.etiqueta}</span>
            <span style={{ color: C.crema, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {[d.tareas ? `${d.tareas} ${d.tareas === 1 ? "tarea" : "tareas"}` : "", d.contenidos.slice(0, 2).join(" · ")].filter(Boolean).join(" · ")}
            </span>
          </div>
        ))}
      </div>
    );
  }

  const max = Math.max(1, ...m.dias.map((d) => d.minutos));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flex: 1, minHeight: 0, paddingBottom: 6 }}>
        {m.dias.map((d) => (
          <div key={d.fecha} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: C.crema }}>{d.minutos > 0 ? `${d.minutos}′` : ""}</span>
            <div style={{ width: "70%", height: `${Math.max(6, (d.minutos / max) * 72)}%`, borderRadius: 10, background: d.esPartido ? C.rival : C.oro, marginTop: 6 }} />
            <span style={{ marginTop: 8, fontSize: 19, fontWeight: 700, color: C.suave }}>{d.md || d.etiqueta}</span>
            <span style={{ fontSize: 16, color: C.tenue }}>{d.etiqueta}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 22, marginTop: 10, fontSize: 21, fontWeight: 600, color: C.suave }}>
        <span>
          {/* Sin el partido (25/10/2026): «340′ de trabajo» llevaba dentro sus 90′; el completo dice 250′. */}
          <b style={{ color: C.crema, fontSize: 28 }}>{m.dias.filter((d) => !d.esPartido).reduce((a, d) => a + d.minutos, 0)}′</b> de entrenamiento
        </span>
        {minutosAbpInforme(inf).minutos > 0 && (
          <span>
            {/* La misma cifra que el informe de ABP (20/10/2026). */}
            <b style={{ color: C.crema, fontSize: 28 }}>{minutosLegibles(minutosAbpInforme(inf).minutos)}</b> de balón parado
          </span>
        )}
        {m.totales.valoracionMedia !== null && (
          <span>
            <b style={{ color: C.crema, fontSize: 28 }}>{m.totales.valoracionMedia.toLocaleString("es-ES")}</b> de nota
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LAS DIAPOSITIVAS                                                   */
/* ------------------------------------------------------------------ */

/* Los bloques del duelo, en el orden en que se lee un partido. */
const BLOQUES = ["Resultado", "Con balón", "Transiciones", "Sin balón", "Balón parado"] as const;

/**
 * Las métricas en las que más se separan los dos, por bloques (20/10/2026):
 * antes eran las dos primeras de cada bloque, 10 cifras con su puesto que
 * no decidían nada; la tabla entera va en el informe completo.
 */
function metricasPorBloque(inf: InformePartido) {
  /* Cuatro: lo que se lee en cinco segundos sin tapar el titular (21/10/2026); la tabla entera, en el completo. */
  const todas = metricasQueSeparan(inf.duelo, 4);

  return BLOQUES.map((b) => ({ bloque: b, metricas: todas.filter((m) => m.bloque === b) })).filter((x) => x.metricas.length);
}

/** Los dos en datos, por bloques: nosotros a la izquierda, ellos a la derecha. */
function DatosPorBloques({ inf }: { inf: InformePartido }) {
  const grupos = metricasPorBloque(inf);

  const ellos = inf.partido.rival.toUpperCase();

  if (!grupos.length) return null;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, letterSpacing: "0.16em", marginBottom: 4 }}>
        <span style={{ color: C.oro }}>NOSOTROS · PUESTO</span>
        <span style={{ color: C.rival }}>{ellos.length > 22 ? `${ellos.slice(0, 21)}…` : ellos}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, minHeight: 0 }}>
        {grupos.map((g) => (
          <div key={g.bloque}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.22em", color: C.tenue, textAlign: "center", margin: "2px 0 2px" }}>{g.bloque.toUpperCase()}</div>
            {g.metricas.map((m) => (
              <FilaDuelo key={m.key} m={m} equipos={inf.duelo?.equipos ?? 0} compacta />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/** Victoria, empate y derrota en una barra, con su cifra. */
function BarraResultado({ p, alto = 64, resaltar }: { p: Probabilidades; alto?: number; resaltar?: "victoria" | "empate" | "derrota" }) {
  const tramos = [
    { k: "victoria" as const, v: p.victoria, color: C.oro, rotulo: "VICTORIA" },
    { k: "empate" as const, v: p.empate, color: C.neutro, rotulo: "EMPATE" },
    { k: "derrota" as const, v: p.derrota, color: C.rival, rotulo: "DERROTA" },
  ];

  return (
    <div>
      <div style={{ display: "flex", height: alto, borderRadius: 14, overflow: "hidden" }}>
        {tramos.map((t) => (
          <div
            key={t.k}
            style={{
              width: `${t.v * 100}%`,
              background: t.color,
              opacity: resaltar && resaltar !== t.k ? 0.35 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: alto * 0.5,
              fontWeight: 700,
              color: "#08111F",
            }}
          >
            {t.v >= 0.12 ? pct(t.v) : ""}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", marginTop: 6 }}>
        {tramos.map((t) => (
          <div key={t.k} style={{ width: `${t.v * 100}%`, textAlign: "center", fontSize: 15, fontWeight: 700, letterSpacing: "0.14em", color: t.k === resaltar ? C.crema : C.tenue, whiteSpace: "nowrap" }}>
            {t.v >= 0.12 ? t.rotulo : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function Cifra({ rotulo, valor, pie, color = C.crema }: { rotulo: string; valor: string; pie?: string; color?: string }) {
  return (
    <div style={{ padding: "12px 16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: `2px solid ${C.borde}` }}>
      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.16em", color: C.tenue, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rotulo}</div>
      <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.05, color }}>{valor}</div>
      {pie ? <div style={{ fontSize: 15, color: C.tenue, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pie}</div> : null}
    </div>
  );
}

/* Goles y asistencias con sus minutos (25/10/2026): «2 goles y 1 asist. en 217′»; el suplente, «si entra». */
const rasgosDe = (j: JugadorRival) =>
  [j.desdeBanquillo ? "si entra" : "", [j.goles ? `${j.goles} ${j.goles === 1 ? "gol" : "goles"}` : "", j.asistencias ? `${j.asistencias} ${j.asistencias === 1 ? "asistencia" : "asist."}` : ""].filter(Boolean).join(" y ") + (j.minutos && (j.goles || j.asistencias) ? ` en ${j.minutos}′` : ""), ...j.rasgos.slice(0, j.desdeBanquillo ? 1 : 2)]
    .filter(Boolean)
    .join(" · ") || recorta(j.fortalezas.split(/\n/)[0] ?? "", 60);

/** A quién vigilar, en una fila: dorsal, nombre y por qué. */
function VigilarFila({ j }: { j: JugadorRival }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <Cara j={j} size={58} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.05, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {j.nombre} <span style={{ fontSize: 17, fontWeight: 600, color: C.tenue, textTransform: "none" }}>{j.posicion.toLowerCase()}</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.oroClaro, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rasgosDe(j)}</div>
      </div>
    </div>
  );
}

/** Cómo juega el rival: una línea por momento y dónde hacerles daño (`sinVigilar`: «A vigilar» va en otra lámina). */
function PanelSuJuego({ inf, sinVigilar = false }: { inf: InformePartido; sinVigilar?: boolean }) {
  const r = inf.colectivo?.resumen;

  const vigilar = sinVigilar ? [] : inf.sintesis.vigilar;

  if (!r?.fases.length && !r?.dano.length && !vigilar.length) return null;

  return (
    <Panel titulo="CÓMO JUEGAN" acento={C.rival}>
      {r?.fases.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {r.fases.map((f) => (
            <div key={f.titulo}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.rival }}>{f.titulo.toUpperCase()}</div>
              <div style={{ fontSize: 21, fontWeight: 600, lineHeight: 1.15, color: C.crema }}>{recorta(f.texto, 120)}</div>
            </div>
          ))}
        </div>
      ) : null}

      {r?.dano.length ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.bien }}>DÓNDE HACERLES DAÑO</div>
          {r.dano.slice(0, 2).map((t) => (
            <div key={t} style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.15, color: C.crema, marginTop: 4 }}>
              <span style={{ color: C.bien }}>▸ </span>
              {recorta(t, 130)}
            </div>
          ))}
        </div>
      ) : null}

      {vigilar.length ? (
        <div style={{ marginTop: "auto", paddingTop: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.rival, marginBottom: 8 }}>A VIGILAR</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {vigilar.map((j) => (
              <VigilarFila key={j.clave} j={j} />
            ))}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

/** Lo esencial del informe de ABP de la semana. */
/** «0'», «0′», «0 de 5…»: un cero de minutos antes de que la semana tenga registro no es una medida. */
const esCeroDeMinutos = (t: string) => /^0\s*['′]?$/.test(t.trim()) || /(^|\s)0\s*['′]\s*(de|en)\b/i.test(t) || /\b0 de \d+ urgencias\b/i.test(t);

/** `compacto`: dos cifras y una línea (post, 21/10/2026): el informe de balón parado va aparte y entero. */
function PanelAbp({ inf, titulo = "BALÓN PARADO", compacto = false }: { inf: InformePartido; titulo?: string; compacto?: boolean }) {
  const p = inf.abp?.pincelada;

  const plan = fraseUtil(inf.plan?.abpOf, 90);
  const planDef = fraseUtil(inf.plan?.abpDef, 90);

  /*
  | En la previa, sin minutos de ABP en la semana, fuera los ceros (20/10/2026):
  | «0′ de trabajo», «0 de 5 urgencias», «faltan 30′». Queda lo planificado
  | y lo del rival. El titular de ABP lo arregla su propio informe (lib/abp).
  */
  const sinMinutos = inf.momento === "previa" && !minutosAbpInforme(inf).minutos;

  const cifras = (p?.cifras ?? []).filter((c) => !(sinMinutos && (esCeroDeMinutos(c.valor) || esCeroDeMinutos(c.pie ?? ""))));
  const claves = (p?.claves ?? []).filter((t) => !(sinMinutos && (esCeroDeMinutos(t) || /faltan \d+['′]|sin trabajar/i.test(t))));
  const titularAbp = p && !(sinMinutos && esCeroDeMinutos(p.titular)) ? p.titular : "";

  if (!p && !plan && !planDef) return null;

  return (
    <Panel titulo={titulo}>
      {p ? (
        <>
          {titularAbp ? <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, color: C.crema }}>{recorta(titularAbp, 130)}</div> : null}
          {cifras.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              {cifras.slice(0, compacto ? 2 : 4).map((c) => (
                <div key={c.rotulo} style={{ padding: "8px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: `2px solid ${C.borde}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", color: C.tenue, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.rotulo}</div>
                  <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.05, color: C.oro }}>{c.valor}</div>
                  {c.pie ? <div style={{ fontSize: 14, color: C.tenue, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.pie}</div> : null}
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {claves.slice(0, compacto ? 1 : 2).map((t) => (
              <div key={t} style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.15, color: C.crema }}>
                <span style={{ color: C.oro }}>▸ </span>
                {recorta(t, 130)}
              </div>
            ))}
            {p.rival.slice(0, compacto ? 0 : 1).map((t) => (
              <div key={t} style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.15, color: C.crema }}>
                <span style={{ color: C.rival }}>▸ </span>
                {recorta(t, 130)}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {plan ? (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.oro }}>OFENSIVO</div>
              <div style={{ fontSize: 21, fontWeight: 600, color: C.crema }}>{plan}</div>
            </div>
          ) : null}
          {planDef ? (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.oro }}>DEFENSIVO</div>
              <div style={{ fontSize: 21, fontWeight: 600, color: C.crema }}>{planDef}</div>
            </div>
          ) : null}
          {inf.abp?.laminasRival ? <div style={{ fontSize: 17, color: C.tenue }}>{inf.abp.laminasRival} láminas del rival preparadas</div> : null}
        </div>
      )}
    </Panel>
  );
}

/** ¿Hay algo que enseñar de la semana? (si no, el panel no sale). */
const haySemana = (inf: InformePartido) => Boolean(inf.microciclo?.dias.some((d) => d.minutos > 0 && !d.esPartido) || inf.microciclo?.dias.some((d) => !d.esPartido && (d.tareas > 0 || d.contenidos.length)));

/*
| «Cómo lo ganamos» (20/10/2026): una línea por fase, con su rótulo, en vez
| de cuatro fichas cortadas con «…» («Atacar · … P97…»). Si el cuerpo técnico
| escribió tres o más claves en el plan, mandan sus palabras, enteras.
| «El plan mueve el pronóstico» (+6, +6, +3) sale del resumen: queda en el
| capítulo del pronóstico del informe completo.
*/
function ComoLoGanamos({ inf }: { inf: InformePartido }) {
  const delPlan = inf.plan?.claves ?? [];

  if (delPlan.length >= 3) return <Lista items={delPlan} numerada tamano={26} max={4} corte={400} />;

  const filas = [...delPlan.map((t) => ({ fase: "Clave", texto: t })), ...inf.sintesis.plan].slice(0, 4);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {filas.map((l) => (
        <div key={`${l.fase}${l.texto}`}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.2em", color: C.oro }}>{l.fase.toUpperCase()}</div>
          <div style={{ fontSize: 29, fontWeight: 700, lineHeight: 1.12, color: C.crema, marginTop: 2 }}>{l.texto}</div>
        </div>
      ))}
    </div>
  );
}

function PostResultado({ inf }: { inf: InformePartido }) {
  const p = inf.partido;

  const cronica = inf.cronica;

  const metricas = (inf.duelo?.partido?.metricas ?? []).filter((m) => m.nuestro !== null && m.suyo !== null).slice(0, cronica?.goles.length ? 7 : 9);

  const relato = inf.sintesis.relato;

  /* Con la línea de goles el panel tiene menos alto: dos filas menos. */
  const temporada = (inf.duelo?.metricas ?? []).filter((m) => m.nosotros && m.rival && conDato(m)).slice(0, cronica?.goles.length ? 6 : 8);

  const real = cronica?.onceReal ?? [];

  const acierto = cronica?.acierto ?? null;

  const sorpresas = new Set(real.filter((r) => acierto?.sorpresas.includes(r.nombre)).map((r) => r.clave));

  const marcador = p.gf !== null && p.gc !== null ? (p.lado === "fuera" ? `${p.gc} - ${p.gf}` : `${p.gf} - ${p.gc}`) : "VS";

  const [local, visitante] = p.lado === "fuera" ? [p.rival.toUpperCase(), "RM CASTILLA"] : ["RM CASTILLA", p.rival.toUpperCase()];

  return (
    <Marco pagina={1} total={3} etiqueta="EL RESULTADO" inf={inf}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 22, minWidth: 600 }}>
          <span style={{ fontSize: 58, fontWeight: 700 }}>{local}</span>
          <Escudo src={(p.lado === "fuera" ? inf.contexto?.escudo : inf.contexto?.escudoNuestro) ?? ""} size={78} />
        </div>
        <div style={{ fontSize: 108, fontWeight: 700, color: C.oro, lineHeight: 1, padding: "0 30px", borderRadius: 26, background: "rgba(200,169,107,0.1)" }}>{marcador}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 22, minWidth: 600 }}>
          <Escudo src={(p.lado === "fuera" ? inf.contexto?.escudoNuestro : inf.contexto?.escudo) ?? ""} size={78} />
          <span style={{ fontSize: 58, fontWeight: 700 }}>{visitante}</span>
        </div>
      </div>
      {/* El giro del partido, no el marcador que ya está encima (20/10/2026). */}
      <div style={{ textAlign: "center", fontSize: 32, fontWeight: 700, lineHeight: 1.1, color: C.oroClaro, marginTop: 6 }}>{inf.sintesis.titular}</div>
      {inf.sintesis.subtitular ? <div style={{ textAlign: "center", fontSize: 21, fontWeight: 600, letterSpacing: "0.04em", color: C.suave, marginTop: 2 }}>{inf.sintesis.subtitular}</div> : null}

      {cronica?.goles.length ? <LineaGoles goles={cronica.goles} /> : null}

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: relato.length ? "0.95fr 1.2fr 0.85fr" : "1.5fr 1fr", gap: 22, marginTop: cronica?.goles.length ? 8 : 22 }}>
        {/* «Cómo fue» junto al marcador (21/10/2026): el relato iba a mitad de la
            diapositiva 2, detrás del pronóstico, y el arco «qué pasó → qué nos
            deja» se rompía. */}
        {relato.length ? (
          <Panel titulo="CÓMO FUE">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {relato.map((t) => {
                const [min, ...resto] = t.split(" · ");

                return (
                  <div key={t} style={{ display: "flex", gap: 12, alignItems: "baseline", fontSize: 21, fontWeight: 600, lineHeight: 1.2 }}>
                    <span style={{ width: 62, flexShrink: 0, textAlign: "right", color: C.oro, fontWeight: 700 }}>{min}</span>
                    <span style={{ color: C.crema, minWidth: 0 }}>{resto.join(" · ")}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        ) : null}

        {/* Sin el partido en Wyscout (se baja los martes), el panel no se queda
            vacío: enseña cómo llegábamos los dos a la jornada. */}
        {!metricas.length && temporada.length ? (
          <Panel titulo="CÓMO LLEGÁBAMOS LOS DOS">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 21, fontWeight: 700, letterSpacing: "0.16em", marginBottom: 8 }}>
              <span style={{ color: C.oro }}>NOSOTROS · PUESTO EN LA LIGA</span>
              <span style={{ color: C.rival }}>{p.rival.toUpperCase()}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
              {temporada.map((m) => (
                <FilaDuelo key={m.key} m={m} equipos={inf.duelo?.equipos ?? 0} compacta={relato.length > 0} />
              ))}
            </div>
            {inf.pronostico ? (
              <div style={{ marginTop: 8, fontSize: 18, color: C.suave }}>
                El pronóstico daba <b style={{ color: C.oro }}>{pct(inf.pronostico.victoria)}</b> de victoria, {pct(inf.pronostico.empate)} de empate y {pct(inf.pronostico.derrota)} de derrota.
              </div>
            ) : null}
            <div style={{ marginTop: 8, fontSize: 18, color: C.tenue }}>Medias de la temporada hasta la jornada.</div>
          </Panel>
        ) : (
          <Panel titulo="EL PARTIDO EN DATOS">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 21, fontWeight: 700, letterSpacing: "0.16em", marginBottom: 8 }}>
              <span style={{ color: C.oro }}>NOSOTROS</span>
              <span style={{ color: C.rival }}>{p.rival.toUpperCase()}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
              {metricas.map((m) => {
                const tope = Math.max(Math.abs(m.nuestro ?? 0), Math.abs(m.suyo ?? 0), 0.0001);

                /* Con «Cómo fue» al lado, la columna es más estrecha: cifras y rótulo más pequeños, en dos líneas si hace falta. */
                const estrecha = relato.length > 0;

                return (
                  <div key={m.key} style={{ display: "flex", alignItems: "center", gap: estrecha ? 8 : 12 }}>
                    <span style={{ width: estrecha ? 84 : 110, flexShrink: 0, textAlign: "right", fontSize: estrecha ? 26 : 30, fontWeight: 700 }}>{cifra(m.nuestro, unidadPartido(m))}</span>
                    <div style={{ flex: 1, height: estrecha ? 16 : 20, display: "flex", justifyContent: "flex-end", background: "rgba(255,255,255,0.05)", borderRadius: 10 }}>
                      <div style={{ width: `${(Math.abs(m.nuestro ?? 0) / tope) * 100}%`, background: C.oro, borderRadius: 10 }} />
                    </div>
                    <span style={{ width: estrecha ? 200 : 300, flexShrink: 0, textAlign: "center", fontSize: estrecha ? 17 : 21, lineHeight: 1.05, fontWeight: 700, color: C.suave, textTransform: "uppercase" }}>{sinSiglas(nombreMetricaPartido(m, cronica))}</span>
                    <div style={{ flex: 1, height: estrecha ? 16 : 20, background: "rgba(255,255,255,0.05)", borderRadius: 10 }}>
                      <div style={{ width: `${(Math.abs(m.suyo ?? 0) / tope) * 100}%`, height: "100%", background: C.rival, borderRadius: 10 }} />
                    </div>
                    <span style={{ width: estrecha ? 84 : 110, flexShrink: 0, fontSize: estrecha ? 26 : 30, fontWeight: 700 }}>{cifra(m.suyo, unidadPartido(m))}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {/* Su once de verdad (BeSoccer) y, si había uno marcado, cuánto acertamos. */}
        <Panel
          titulo={real.length ? `SU ONCE${cronica?.estructura ? ` · ${cronica.estructura}` : ""}` : inf.once.fuente === "marcado" ? "SU ONCE PREVISTO" : "SU ONCE"}
          acento={C.rival}
        >
          {real.length || inf.once.jugadores.length ? (
            <Campo once={real.length ? real : inf.once.jugadores} resaltar={sorpresas} />
          ) : null}
          {acierto && (
            <div style={{ marginTop: 10, textAlign: "center", fontSize: 22, fontWeight: 600, color: C.suave }}>
              <b style={{ color: C.oro, fontSize: 30 }}>
                {acierto.acertados}/{acierto.total}
              </b>{" "}
              del once previsto
              {acierto.sorpresas.length ? <span style={{ color: C.tenue }}> · en oro, los que no esperábamos</span> : null}
            </div>
          )}
        </Panel>
      </div>

      <Pie inf={inf} />
    </Marco>
  );
}

/** «45+1» → 45,5; «9» → 9: dónde cae en la línea del partido. */
const minutoDe = (m: string) => {
  const [base, extra] = m.split("+").map((x) => Number.parseInt(x, 10) || 0);

  return base + Math.min(extra ?? 0, 6) * 0.5;
};

/** Los goles en la línea del partido: los nuestros arriba, los suyos abajo. */
function LineaGoles({ goles }: { goles: GolCronica[] }) {
  const fin = Math.max(92, ...goles.map((g) => minutoDe(g.minuto) + 2));

  const x = (min: number) => `${(min / fin) * 100}%`;

  const raya = 62;

  /* El rótulo del descanso va donde no haya un gol cerca del 45. */
  const cerca = (nuestro: boolean) => goles.some((g) => g.nuestro === nuestro && Math.abs(minutoDe(g.minuto) - 45) < 9);

  const descanso = !cerca(false) ? "abajo" : !cerca(true) ? "arriba" : null;

  return (
    <div style={{ position: "relative", height: 132, margin: "10px 70px 0" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: raya, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.14)" }} />
      {[0, 45, 90].map((m) => (
        <div key={m} style={{ position: "absolute", left: x(m), top: raya - 9, width: 2, height: 22, background: "rgba(255,255,255,0.3)", transform: "translateX(-1px)" }} />
      ))}
      {descanso && (
        <div style={{ position: "absolute", left: x(45), top: descanso === "abajo" ? raya + 16 : raya - 34, transform: "translateX(-50%)", fontSize: 15, fontWeight: 700, letterSpacing: "0.16em", color: C.tenue }}>
          DESCANSO
        </div>
      )}
      <div style={{ position: "absolute", left: -56, top: raya - 12, fontSize: 18, fontWeight: 700, color: C.tenue }}>0′</div>
      <div style={{ position: "absolute", right: -60, top: raya - 12, fontSize: 18, fontWeight: 700, color: C.tenue }}>90′</div>

      {goles.map((g, i) => {
        const color = g.nuestro ? C.oro : C.rival;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x(minutoDe(g.minuto)),
              top: g.nuestro ? 0 : raya - 8,
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: g.nuestro ? "column" : "column-reverse",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div style={{ whiteSpace: "nowrap", lineHeight: 1.05, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.crema }}>
                {apellido(g.jugador).toUpperCase()}
                {g.tipo === "penalti" ? " (P)" : g.tipo === "propia" ? " (PP)" : ""}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color }}>{g.minuto}′</div>
            </div>
            <span style={{ width: 20, height: 20, borderRadius: 999, background: color, border: "3px solid #0C1A2E", boxShadow: `0 0 0 2px ${color}` }} />
          </div>
        );
      })}
    </div>
  );
}

/** Forma de los dos y la clasificación, en una línea. */
function Pie({ inf }: { inf: InformePartido }) {
  const ctx = inf.contexto;

  return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, gap: 30 }}>
        <Forma titulo="NOSOTROS" resultados={ctx?.nuestraRacha.length ? ctx.nuestraRacha : deForma(inf.duelo?.forma.nosotros)} />
        <div style={{ fontSize: 22, fontWeight: 600, color: C.suave, textAlign: "center" }}>
          {ctx?.nuestroPuesto && ctx.puesto ? (
            <>
              Clasificación: <b style={{ color: C.oro }}>{ordinal(ctx.nuestroPuesto)} · {ctx.nuestrosPuntos} pts</b> <span style={{ color: C.tenue }}>contra</span>{" "}
              <b style={{ color: C.rival }}>{ordinal(ctx.puesto)} · {ctx.puntos} pts</b>
            </>
          ) : null}
        </div>
        <Forma titulo="ELLOS" resultados={ctx?.racha.length ? ctx.racha : deForma(inf.duelo?.forma.rival)} derecha />
      </div>
  );
}

/** El titular de una diapositiva: la conclusión en una frase, sobre los paneles (21/10/2026). */
function TitularDiapo({ texto }: { texto: string }) {
  if (!texto) return null;

  return <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1, color: C.oroClaro, marginBottom: 16 }}>{texto}</div>;
}

/*
| POST · 2 «Lo que buscábamos» (21/10/2026). Antes, catorce bloques en una
| lámina y «Cómo fue» enterrado detrás del pronóstico. Ahora: el titular con
| la conclusión, lo que nos propusimos y si se cumplió, el pronóstico en
| dos frases, el balón parado en corto y, a todo el ancho, lo que toca esta
| semana. El relato ya va en la 1; las palancas, en el informe completo.
*/
function PostLecciones({ inf }: { inf: InformePartido }) {
  const pr = inf.pronostico;

  const p = inf.partido;

  const real = p.gf !== null && p.gc !== null ? (p.gf > p.gc ? "victoria" : p.gf < p.gc ? "derrota" : "empate") : undefined;

  const xg = lecturaXg(inf);

  /* Una marca de veredicto: ✓, ✗ o = (dentro de lo habitual). */
  const marca = (v: "si" | "no" | "igual" | null | boolean) => {
    const bien = v === "si" || v === true;
    const mal = v === "no" || v === false;

    return (
      <span style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, color: "#08111F", background: bien ? C.bien : mal ? C.mal : C.neutro }}>
        {bien ? "✓" : mal ? "✗" : "="}
      </span>
    );
  };

  return (
    <Marco pagina={2} total={3} etiqueta="LO QUE BUSCÁBAMOS" inf={inf}>
      <TitularDiapo texto={inf.sintesis.titularPlan} />

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1.15fr 1fr 0.9fr", gap: 22 }}>
        <Panel titulo="LO QUE NOS PROPUSIMOS">
          {inf.sintesis.cumplimiento.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {inf.sintesis.cumplimiento.slice(0, 3).map((f) => (
                <div key={f.clave} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {f.veredicto ? marca(f.veredicto) : <span style={{ width: 30, flexShrink: 0 }} />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.15, color: C.crema }}>{f.lectura || recorta(f.clave, 110)}</div>
                    {f.dato ? <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.2, color: C.suave, marginTop: 2 }}>{f.dato}</div> : null}
                    {f.matiz ? <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.2, color: C.oroClaro, marginTop: 2 }}>Ojo: {f.matiz}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {/* Una sola regla, la misma en el completo y en el vídeo (25/10/2026). */}
          {inf.sintesis.cumplimiento.some((f) => f.veredicto) ? <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.25, color: C.tenue }}>{REGLA_VEREDICTO}</div> : null}
          {/* La roja pesa en estas cifras (24/10/2026): en la fila si la toca; si no, al pie. */}
          {inf.sintesis.notaRoja && !inf.sintesis.cumplimiento.some((f) => f.matiz) ? <div style={{ marginTop: 8, fontSize: 16, fontWeight: 600, lineHeight: 1.25, color: C.oroClaro }}>{inf.sintesis.notaRoja}.</div> : null}
          {inf.sintesis.frenados.length > 0 ? (
            <div style={{ marginTop: "auto", paddingTop: 14 }}>
              {/* En frases (22/10/2026): «¿LOS FRENAMOS?» con «✓», «!» y dorsales era un acertijo en el móvil. */}
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.rival, marginBottom: 8 }}>A QUIÉN TENÍAMOS QUE FRENAR</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {inf.sintesis.frenados.map((f) => (
                    <Cara key={f.jugador.clave} j={f.jugador} size={44} color={f.bien ? C.bien : C.mal} />
                  ))}
                </div>
                <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.25, color: C.crema }}>{fraseFrenados(inf.sintesis.frenados)}.</div>
              </div>
            </div>
          ) : null}
        </Panel>

        {/* El bloque dice lo que es (24/10/2026): antes «LO QUE NOS DEJA» encima del pronóstico. */}
        <Panel titulo="FRENTE A LO PREVISTO">
          {pr ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.oro, marginBottom: 6 }}>EL PRONÓSTICO Y EL RESULTADO</div>
              <BarraResultado p={pr} alto={42} resaltar={real} />
              {inf.sintesis.veredicto ? <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.15, color: C.crema, marginTop: 8 }}>{inf.sintesis.veredicto}.</div> : null}
              {/* Una idea por frase y dos cifras como mucho en cada una (21/10/2026). */}
              {xg
                ? xg.split(". ").map((f) => (
                    <div key={f} style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.2, color: C.suave, marginTop: 4 }}>
                      {f}.
                    </div>
                  ))
                : null}
            </div>
          ) : null}
          <Lista items={inf.sintesis.claves} tamano={21} max={3} corte={160} />
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, minHeight: 0 }}>
          <PanelAbp inf={inf} titulo="BALÓN PARADO DEL PARTIDO" compacto />
          {haySemana(inf) ? (
            <Panel titulo="LA SEMANA QUE LO PREPARÓ" style={{ flex: 1 }}>
              <Semana inf={inf} />
            </Panel>
          ) : null}
        </div>
      </div>

      {/* «ESTA SEMANA» pasa al final de la 3 (22/10/2026): el resumen del post acaba en las consignas. */}
    </Marco>
  );
}


/* ------------------------------------------------------------------ */
/*  3 · LOS DUELOS Y EL RIVAL DE UN VISTAZO (06/10/2026)               */
/* ------------------------------------------------------------------ */

const LUGAR_CORTO: Record<string, string> = {
  "cen-del": "POR DENTRO",
  "latd-bani": "BANDA DERECHA",
  "lati-band": "BANDA IZQUIERDA",
  "piv-media": "ENTRE LÍNEAS",
  medio: "LA MEDULAR",
  "media-piv": "ENTRE LÍNEAS",
  "band-lati": "BANDA DERECHA",
  "bani-latd": "BANDA IZQUIERDA",
  "del-cen": "POR DENTRO",
};

/** Un duelo en una fila: la cifra grande, quién contra quién, dónde y por qué. */
function FilaDueloJugadores({ x, lado }: { x: DueloJugadores; lado: "con" | "sin" }) {
  /* La media de los cruces que se ven, no el balance de todos (21/10/2026): «+38» junto a 69-12 y 77-24 no cuadraba. */
  const valor = ventajaVisible(x, lado);
  const color = lado === "con" ? C.bien : C.mal;
  /* Con dorsal y sin apellidos repetidos (ronda 10): `quienDuelo`. */
  const [a, b] = lado === "con" ? [quienDuelo(x, "nuestros"), quienDuelo(x, "suyos")] : [quienDuelo(x, "suyos"), quienDuelo(x, "nuestros")];
  /* Lo que hacemos en palabras y, debajo, las cifras que suman la grande (22/10/2026). */
  const conducta = conductaDuelo(x, lado);
  const cifras = cifrasDuelo(x, lado);

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "10px 14px", borderRadius: 14, background: `${color}12`, border: `2px solid ${color}33` }}>
      <div style={{ width: 78, flexShrink: 0, textAlign: "center" }}>
        <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color }}>
          {valor !== null && valor > 0 ? "+" : ""}
          {valor}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: C.tenue }}>{LUGAR_CORTO[x.clave] ?? ""}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <span style={{ color: lado === "con" ? C.oro : C.crema }}>{a.charAt(0).toUpperCase() + a.slice(1)}</span>
          <span style={{ color: C.tenue, fontWeight: 600 }}> ante </span>
          <span style={{ color: lado === "con" ? C.crema : C.oro }}>{b}</span>
        </div>
        {conducta ? (
          <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.2, color: C.crema }}>
            {conducta.charAt(0).toUpperCase() + conducta.slice(1)}
          </div>
        ) : null}
        {cifras ? <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2, color: C.tenue }}>{cifras}</div> : null}
      </div>
    </div>
  );
}

/*
| El pie cuadra con las filas que se ven (26/10/2026, análisis: «9 de 9
| duelos medidos» bajo seis filas). Un duelo puede salir con balón y sin él:
| se cuentan los distintos y se dice.
*/
function cuentaDuelos(atacar: DueloJugadores[], vigilar: DueloJugadores[], medidos: number) {
  const filas = atacar.length + vigilar.length;

  const distintos = new Set([...atacar, ...vigilar].map((x) => x.clave)).size;

  const repetidos = filas - distintos;

  const dobles = repetidos ? ` (${repetidos === 1 ? "uno sale" : `${repetidos} salen`} con balón y sin él)` : "";

  return distintos >= medidos ? `Los ${medidos} duelos medidos${dobles}` : `Los ${distintos} duelos más claros de los ${medidos} medidos${dobles}`;
}

function PanelDuelos({ inf, post }: { inf: InformePartido; post: boolean }) {
  const d = inf.duelosJugadores;


  /* Los mismos que cuenta su titular y que sostienen LA IDEA (25/10/2026): una sola selección, en modelo.ts. */
  const { atacar, vigilar } = duelosDeLaLamina({ ...inf, momento: post ? "post" : "previa" });
  const medidos = (d?.lista ?? []).filter((x) => x.veredicto !== "sin-datos").length;

  /* Lo que no tiene dato no se nombra: sin duelos, el panel no sale; sin un lado, ese lado no sale. */
  if (!d || (!atacar.length && !vigilar.length)) return null;

  return (
    <Panel titulo={post ? "LOS DUELOS QUE PLANTEAMOS" : "LOS DUELOS"}>
      {atacar.length ? (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.bien, marginBottom: 8 }}>
            {post ? "DÓNDE ESPERÁBAMOS HACERLES DAÑO · CON BALÓN" : "DÓNDE LES HACEMOS DAÑO · CON BALÓN"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {atacar.map((x) => (
              <FilaDueloJugadores key={x.clave} x={x} lado="con" />
            ))}
          </div>
        </>
      ) : null}
      {vigilar.length ? (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.mal, margin: atacar.length ? "18px 0 8px" : "0 0 8px" }}>
            {post ? "DÓNDE NOS PODÍAN HACER DAÑO · SIN BALÓN" : "DÓNDE NOS PUEDEN HACER DAÑO · SIN BALÓN"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {vigilar.map((x) => (
              <FilaDueloJugadores key={x.clave} x={x} lado="sin" />
            ))}
          </div>
        </>
      ) : null}
      <div style={{ marginTop: "auto", paddingTop: 12, fontSize: 15, color: C.tenue }}>
        {cuentaDuelos(atacar, vigilar, medidos)} · con balón de uno contra sin balón del otro · cada cifra pequeña es su percentil contra los de su puesto en la categoría (97 = mejor que 97 de cada 100); la grande, la diferencia media de los cruces de su fila · {recorta(d.fuenteSuya, 70)}
      </div>
    </Panel>
  );
}

function PanelVistazo({ inf }: { inf: InformePartido }) {
  const v = inf.vistazo;

  /* Sin partidos suyos en Wyscout, el panel no sale (el informe no nombra lo que no tiene). */
  if (!v) return null;
  const color = (p: number | null) => (p === null ? C.neutro : p >= 60 ? C.bien : p <= 40 ? C.mal : C.oro);

  return (
    <Panel titulo={`${(inf.partido.rival || "EL RIVAL").toUpperCase()} DE UN VISTAZO`} acento={C.rival}>
      {(
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <Cifra rotulo="G · E · P" valor={`${v.g}-${v.e}-${v.p}`} pie={`${v.partidos} partidos`} />
            <Cifra rotulo="GOLES" valor={`${v.gf}-${v.gc}`} pie="a favor · en contra" />
            {/* Un solo puesto en todo el informe, el de BeSoccer por puntos (20/10/2026): aquí salía
                el de Wyscout por puntos por partido («11.º») junto al «13.º» de la diapositiva 1. */}
            {inf.contexto?.puesto ? (
              <Cifra rotulo="TABLA" valor={ordinal(inf.contexto.puesto)} pie={inf.contexto.puntos !== null ? `${inf.contexto.puntos} pts` : undefined} color={C.oro} />
            ) : v.tabla ? (
              <Cifra rotulo="TABLA" valor={ordinal(v.tabla.puesto)} pie={`de ${v.tabla.de} · pts/partido`} color={C.oro} />
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.16em", color: C.tenue, marginRight: 6 }}>FORMA</span>
            {v.forma.map((f, i) => (
              <span
                key={i}
                style={{ width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: C.fondo, background: f.resultado === "G" ? C.bien : f.resultado === "P" ? C.mal : C.oro }}
              >
                {f.resultado}
              </span>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 18, fontWeight: 600, color: C.suave }}>{v.sistemas.slice(0, 2).map((s) => s.sistema).join(" · ")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 18px", marginTop: 14 }}>
            {v.fases.filter((f) => f.percentil !== null).map((f) => (
              <div key={f.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 600 }}>
                  <span style={{ color: C.suave }}>{f.label}</span>
                  <span style={{ color: color(f.percentil) }}>{`${f.percentil} de 100`}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ width: `${f.percentil ?? 0}%`, height: "100%", background: color(f.percentil) }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 14 }}>
            {[
              { t: "DESTACA EN", l: v.fuertes, c: C.bien },
              { t: "SUFRE EN", l: v.flojos, c: C.mal },
            ].map((g) => (
              <div key={g.t}>
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.16em", color: g.c }}>{g.t}</div>
                {g.l.slice(0, 3).map((m) => (
                  <div key={m.nombre} style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.25, color: C.crema, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.nombre} <span style={{ color: C.tenue }}>{ordinal(m.puesto)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {v.figuras.length ? (
            <div style={{ marginTop: "auto", paddingTop: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.16em", color: C.rival, marginBottom: 6 }}>LOS QUE MÁS RINDEN PARA SU PUESTO · ÍNDICE DE 0 A 100</div>
              {v.figuras.slice(0, 3).map((f) => (
                <div key={f.nombre} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 19, fontWeight: 600, lineHeight: 1.25 }}>
                  <span style={{ width: 42, color: color(f.indice), fontWeight: 700 }}>{f.indice}</span>
                  <span style={{ color: C.crema, whiteSpace: "nowrap" }}>{f.nombre}</span>
                  <span style={{ color: C.tenue, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[f.posicion, f.destaca[0]].filter(Boolean).join(" · ")}</span>
                </div>
              ))}
            </div>
          ) : null}
          {v.alcance ? <div style={{ marginTop: 8, fontSize: 14, color: C.tenue }}>{v.alcance} · de 0 a 100 contra los de su competición (50, la mitad)</div> : null}
        </>
      )}
    </Panel>
  );
}

/**
 * «ESTA SEMANA» como columna de la 3 del post (24/10/2026): la franja de
 * abajo dejaba media lámina vacía y la llamada a la acción, pequeña. Ahora
 * ocupa la mitad derecha y es lo último que se lee del resumen.
 */
function PanelEstaSemana({ inf }: { inf: InformePartido }) {
  const toca = inf.sintesis.microciclo.slice(0, 3).map((t) => {
    const [consigna, ...dato] = t.split(" · ");

    return { consigna, dato: dato.join(" · ") };
  });

  if (!toca.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 34, padding: "26px 34px", borderRadius: 20, background: "linear-gradient(160deg, rgba(200,169,107,0.22), rgba(200,169,107,0.04))", border: "2px solid rgba(200,169,107,0.5)", minHeight: 0 }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.22em", color: C.oro }}>ESTA SEMANA</div>
      {toca.map((t, i) => (
        <div key={t.consigna} style={{ display: "flex", gap: 16, alignItems: "flex-start", minWidth: 0 }}>
          <span style={{ minWidth: 56, height: 56, borderRadius: 14, background: C.oro, color: "#08111F", fontSize: 32, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 42, fontWeight: 700, lineHeight: 1.05, color: C.crema }}>{t.consigna}</div>
            {t.dato ? <div style={{ fontSize: 25, fontWeight: 600, lineHeight: 1.2, color: C.suave, marginTop: 6 }}>{t.dato}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * POST · 3 (24/10/2026, experto de fútbol, análisis y guion): la lámina
 * repetía lo que esperábamos de los duelos sin decir qué pasó. Sin datos del
 * partido duelo a duelo, cuenta cómo nos marcaron (minuto, marcador, quién y
 * en qué contexto) y acaba en «ESTA SEMANA». Los duelos previstos siguen en
 * el informe completo.
 */
function PanelGolesEnContra({ inf }: { inf: InformePartido }) {
  const goles = inf.sintesis.golesEnContra;

  if (!goles.length) return null;

  return (
    <Panel titulo="CÓMO NOS MARCARON">
      {/* Repartido en el alto de la lámina, con la letra grande: son dos o tres goles, no una tabla (24/10/2026). */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
        {goles.map((g) => {
          const [minuto, marcador, ...resto] = g.split(" · ");

          return (
            <div key={g} style={{ display: "flex", gap: 22, alignItems: "center", padding: "20px 24px", borderRadius: 18, background: `${C.mal}12`, border: `2px solid ${C.mal}33` }}>
              <div style={{ width: 120, flexShrink: 0, textAlign: "center" }}>
                <div style={{ fontSize: 48, fontWeight: 700, lineHeight: 1, color: C.mal }}>{minuto}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: C.crema, marginTop: 4 }}>{marcador}</div>
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2, color: C.crema }}>{resto.join(" · ")}</div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/*
| POST · 3 (22/10/2026): sin datos del partido duelo a duelo no se puede
| decir cuáles ganamos, así que la lámina se queda en los duelos que
| planteamos, a todo el ancho, y acaba en «ESTA SEMANA». El rival de un
| vistazo sale del resumen del post (queda en el completo): ya no sirve para
| nada después del partido.
|
| PREVIA · 3 acaba en lo nuestro (21/10/2026): antes terminaba en «Los que
| más rinden» del rival, un dato sin conclusión. Ahora el rival de un vistazo
| va primero, los duelos después y, al pie, la consigna: las mismas líneas
| que cierran el vídeo, que responden a la pregunta del titular.
*/
function DuelosYRival({ inf }: { inf: InformePartido }) {
  const post = inf.momento === "post";

  const consigna = post ? [] : inf.sintesis.consigna;

  return (
    <Marco pagina={3} total={3} etiqueta={post ? "ESTA SEMANA" : "DUELOS Y RIVAL"} inf={inf}>
      <TitularDiapo texto={inf.sintesis.titularDuelos} />
      {/*
      | Post: el problema y luego la respuesta (25/10/2026, ronda 7, guionista):
      | «Cómo nos marcaron» a la izquierda y «ESTA SEMANA» a la derecha, que es
      | lo último que se lee. La cabecera ya dice «ESTA SEMANA» y el titular,
      | las consignas: lo que toca no se pierde por ir segundo.
      */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: post ? (inf.sintesis.golesEnContra.length ? "1fr 1.15fr" : "1fr") : "1fr 1.2fr", gap: 22 }}>
        {post ? (
          <>
            <PanelGolesEnContra inf={inf} />
            <PanelEstaSemana inf={inf} />
          </>
        ) : (
          <>
            <PanelVistazo inf={inf} />
            <PanelDuelos inf={inf} post={false} />
          </>
        )}
      </div>
      {consigna.length ? (
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 18, padding: "16px 26px", borderRadius: 18, background: "linear-gradient(90deg, rgba(200,169,107,0.24), rgba(200,169,107,0.05))", border: "2px solid rgba(200,169,107,0.5)" }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.22em", color: C.oro, whiteSpace: "nowrap" }}>NUESTRA CONSIGNA</span>
          <span style={{ width: 2, alignSelf: "stretch", background: "rgba(200,169,107,0.5)" }} />
          <span style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1, color: C.crema }}>{consigna.join(". ")}.</span>
        </div>
      ) : null}
    </Marco>
  );
}

/*
| LA PREVIA, EN UNA SOLA HISTORIA (23/10/2026, guionista y experto de fútbol).
| Antes: el pronóstico y una tabla abrían, el plan iba en la 2 y el rival de
| un vistazo llegaba en la 3, después de «cómo lo ganamos». Ahora se lee como
| se prepara un partido: quién es el rival → dónde está el partido → cómo lo
| ganamos, y la última línea es la consigna que contesta a la pregunta del
| titular. El pronóstico baja a una línea pequeña en la 2: es un supuesto,
| no lo que se entrena.
*/

/** Al pie de cada lámina, lo que viene: la transición entre las tres. */
function Siguiente({ texto }: { texto: string }) {
  return <div style={{ marginTop: 14, fontSize: 18, fontWeight: 700, letterSpacing: "0.16em", color: C.tenue, textAlign: "right" }}>{texto.toUpperCase()} →</div>;
}

/** PREVIA · 1 «El rival»: la pregunta, cómo juegan, de un vistazo y su once. */
function PreviaRival({ inf }: { inf: InformePartido }) {
  const ctx = inf.contexto;

  const nosotros = "RM CASTILLA";
  const ellos = inf.partido.rival.toUpperCase();

  const [local, visitante] = inf.partido.lado === "fuera" ? [ellos, nosotros] : [nosotros, ellos];

  return (
    <Marco pagina={1} total={3} etiqueta="EL RIVAL" inf={inf}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40 }}>
        <Escudo src={inf.partido.lado === "fuera" ? ctx?.escudo ?? "" : ctx?.escudoNuestro ?? ""} size={84} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 0.95, letterSpacing: "0.01em" }}>
            {local} <span style={{ color: C.oro }}>·</span> {visitante}
          </div>
          <div style={{ marginTop: 10, fontSize: 32, fontWeight: 700, lineHeight: 1.1, color: C.oroClaro }}>{inf.sintesis.titular}</div>
        </div>
        <Escudo src={inf.partido.lado === "fuera" ? ctx?.escudoNuestro ?? "" : ctx?.escudo ?? ""} size={84} />
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1.05fr 0.85fr", gap: 22, marginTop: 18 }}>
        <PanelSuJuego inf={inf} sinVigilar />
        <PanelVistazo inf={inf} />
        <Panel titulo={inf.once.fuente === "marcado" ? "SU ONCE PROBABLE" : "SU ÚLTIMO ONCE"} acento={C.rival}>
          {inf.once.jugadores.length ? <Campo once={inf.once.jugadores} /> : null}
          <div style={{ marginTop: 8, fontSize: 18, color: C.tenue, textAlign: "center" }}>
            {[inf.duelo?.esquema.rival && `Dibujo más usado: ${inf.duelo.esquema.rival}`, ctx?.entrenador && `Entrenador: ${ctx.entrenador}`].filter(Boolean).join(" · ")}
          </div>
        </Panel>
      </div>

      <Pie inf={inf} />
      <Siguiente texto="2/3 · Dónde está el partido" />
    </Marco>
  );
}

/** El pronóstico en pequeño: una barra y una línea, sin el protagonismo de antes. */
function PronosticoCorto({ inf }: { inf: InformePartido }) {
  const pr = inf.pronostico;

  if (!pr) return null;

  return (
    <Panel titulo="EL PRONÓSTICO">
      <BarraResultado p={pr} alto={40} />
      <div style={{ marginTop: 10, fontSize: 19, fontWeight: 600, lineHeight: 1.25, color: C.suave }}>
        Marcador más probable <b style={{ color: C.crema }}>{pr.marcador}</b> · si se cumplen las metas del plan, <b style={{ color: C.oro }}>{pct(pr.conPlan.victoria)}</b> de victoria
      </div>
      <div style={{ marginTop: 6, fontSize: 15, color: C.tenue }}>{pr.base}</div>
    </Panel>
  );
}

/** PREVIA · 2 «Dónde está el partido»: dónde nos separamos, el pronóstico en pequeño y los duelos. */
function PreviaDondeEsta({ inf }: { inf: InformePartido }) {
  const separan = metricasPorBloque(inf).flatMap((g) => g.metricas);

  return (
    <Marco pagina={2} total={3} etiqueta="DÓNDE ESTÁ EL PARTIDO" inf={inf}>
      <TitularDiapo texto={inf.sintesis.titularDuelos} />
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, minHeight: 0 }}>
          {separan.length ? (
            <Panel titulo="DÓNDE MÁS NOS SEPARAMOS" style={{ flex: 1 }}>
              <DatosPorBloques inf={inf} />
              {inf.duelo && (
                <div style={{ marginTop: 6, fontSize: 15, color: C.tenue }}>
                  {[selloDatos(inf), `media por partido y puesto entre ${inf.duelo.equipos}`, "barra = percentil (larga = mejor)", glosario(separan.map((m) => m.nombre))].filter(Boolean).join(" · ")}
                </div>
              )}
            </Panel>
          ) : null}
          <PronosticoCorto inf={inf} />
        </div>
        <PanelDuelos inf={inf} post={false} />
      </div>
      <Siguiente texto="3/3 · Cómo lo ganamos" />
    </Marco>
  );
}

/*
| Cada línea del plan por fases con la tarea de la semana que la entrena. Es
| la misma historia que LA IDEA: cada fase dice a qué clave del cuerpo
| técnico sirve («CON BALÓN · CLAVE 1») y las claves van debajo, numeradas
| (24/10/2026, guion: eran dos historias sin unir). Lo que no tiene tarea no
| lo dice: va al aviso del analista.
*/
const FASES_PLAN = ["Con balón", "Sin balón", "Transiciones", "Balón parado"];

/** Las tareas de la semana de una línea del plan («Atacamos la espalda de Gomez: …»). */
const tareasDeLinea = (inf: InformePartido, texto: string) =>
  inf.microciclo?.tareas.length ? inf.sintesis.consignaTareas.find((c) => texto === c.consigna || texto.startsWith(`${c.consigna}:`) || texto.startsWith(`${c.consigna} `))?.tareas ?? [] : [];

/*
| UNA lista en la 3/3 (24/10/2026, experto de fútbol, guion y marketing): antes
| salían LA IDEA, «Cómo lo ganamos» con su «Clave 1» (la misma frase que LA
| IDEA) y, debajo, otras tres «claves del cuerpo técnico» sin atar: dos
| relatos. Ahora mandan las claves del cuerpo técnico, en corto y como
| consigna; debajo de cada una, lo concreto de esta semana (la línea del plan
| de su fase) con su tarea. La línea que es LA IDEA no se repite: se marca.
| Lo que no cuelga de ninguna clave queda en el informe completo.
*/
function ClavesConTareas({ inf }: { inf: InformePartido }) {
  const delPlan = (inf.plan?.claves ?? []).slice(0, 3);

  const principal = inf.sintesis.consigna[0] ?? "";

  const esIdea = (texto: string) => Boolean(principal) && (texto === principal || texto.startsWith(`${principal}:`) || texto.startsWith(`${principal} `));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26, flex: 1 }}>
      {delPlan.map((clave, i) => {
        const fase = FASES_PLAN.find((f) => claveDeFase([clave], f) === 1) ?? "";

        const lineas = inf.sintesis.plan.filter((l) => l.fase === fase);

        const idea = lineas.find((l) => esIdea(l.texto));

        const concreta = idea ?? lineas[0];

        const tareas = concreta ? tareasDeLinea(inf, concreta.texto) : [];

        /* De LA IDEA, sólo su porqué («lento y pierde duelos»): la consigna ya está arriba. */
        const dato = concreta ? (idea ? concreta.texto.split(/:\s/).slice(1).join(": ") : concreta.texto) : "";

        return (
          <div key={clave}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.2em", color: C.oro }}>
              {i + 1}
              {fase ? ` · ${fase.toUpperCase()}` : ""}
            </div>
            <div style={{ fontSize: 31, fontWeight: 700, lineHeight: 1.12, color: C.crema, marginTop: 2 }}>{claveEnCorto(clave)}</div>
            {idea ? (
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 5, color: C.oro }}>
                ★ Por aquí, LA IDEA{dato ? <span style={{ fontWeight: 600, color: C.suave }}> · {dato}</span> : null}
              </div>
            ) : dato ? (
              <div style={{ fontSize: 23, fontWeight: 600, lineHeight: 1.2, marginTop: 5, color: C.suave }}>{dato}</div>
            ) : null}
            {metaDeClave(inf, clave, { corta: true }) ? <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.2, marginTop: 4, color: C.suave }}>{metaDeClave(inf, clave, { corta: true })}</div> : null}
            {tareas.length ? <div style={{ fontSize: 19, fontWeight: 600, marginTop: 4, color: C.tenue }}>→ {tareas.join(" · ")}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * La línea con la que se cierra la previa (24/10/2026, guion): dos frases
 * cortas, LA IDEA y la consigna de balón parado, no las tres metas genéricas.
 * «El domingo: atacamos la espalda de Gomez. Y defendemos la falta lateral directa.»
 */
function cierrePrevia(inf: InformePartido) {
  const idea = (inf.sintesis.ideaPrevia || inf.sintesis.consigna[0] || "").replace(/[.]$/, "");

  const abp = (inf.abp?.pincelada?.prioridad?.consigna ?? "").replace(/[.]$/, "");

  if (!idea && !abp) return "";

  const d = inf.partido.cuando ? new Date(inf.partido.cuando) : null;

  const dia = d && !Number.isNaN(d.getTime()) ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long" }).format(d) : "";

  const minus = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

  /*
  | Tres piezas, siempre las mismas, en presente y sin cifras (26/10/2026,
  | guion): LA IDEA con balón, la respuesta al titular de la 1/3 («ganamos la
  | segunda jugada de su balón largo») y el balón parado. Sin repetir.
  */
  const sinPorque = (t: string) => t.split(/:\s/)[0].replace(/[.]$/, "").trim();

  const piezas: string[] = [];

  for (const t of [idea, inf.sintesis.gancho ?? "", abp].map(sinPorque).filter(Boolean)) {
    if (!piezas.some((p) => p.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(p.toLowerCase()))) piezas.push(t);
  }

  if (!piezas.length) return "";

  const frase = piezas.length === 1 ? piezas[0] : `${piezas.slice(0, -1).map(minus).join(", ")} y ${minus(piezas[piezas.length - 1])}`;

  return `${dia ? `El ${dia}: ${minus(frase)}` : frase.charAt(0).toUpperCase() + frase.slice(1)}.`;
}

function PlanConTareas({ inf }: { inf: InformePartido }) {
  const delPlan = inf.plan?.claves ?? [];

  if (!inf.sintesis.plan.length) return <ComoLoGanamos inf={inf} />;

  if (delPlan.length) return <ClavesConTareas inf={inf} />;

  const tareas = (texto: string) => inf.sintesis.consignaTareas.find((c) => texto === c.consigna || texto.startsWith(`${c.consigna}:`) || texto.startsWith(`${c.consigna} `));

  const conTareas = Boolean(inf.microciclo?.tareas.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
      {inf.sintesis.plan.slice(0, 4).map((l) => {
        const t = conTareas ? tareas(l.texto) : undefined;

        return (
          <div key={`${l.fase}${l.texto}`}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.2em", color: C.oro }}>
              {l.fase.toUpperCase()}
              {claveDeFase(delPlan.slice(0, 3), l.fase) ? ` · CLAVE ${claveDeFase(delPlan.slice(0, 3), l.fase)}` : ""}
            </div>
            <div style={{ fontSize: 27, fontWeight: 700, lineHeight: 1.12, color: C.crema, marginTop: 2 }}>{l.texto}</div>
            {t?.tareas.length ? <div style={{ fontSize: 17, fontWeight: 600, marginTop: 3, color: C.suave }}>→ {t.tareas.join(" · ")}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

/** PREVIA · 3 «Cómo lo ganamos»: la idea (la consigna, dicha una vez), el plan por fases, a vigilar, el balón parado y la semana. */
function PreviaComoGanamos({ inf }: { inf: InformePartido }) {
  const idea = inf.sintesis.ideaPrevia || inf.pronostico?.idea || "";

  const vigilar = inf.sintesis.vigilar;

  const semana = haySemana(inf);

  const panelVigilar = vigilar.length ? (
    <Panel titulo="A VIGILAR" acento={C.rival}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {vigilar.map((j) => (
          <VigilarFila key={j.clave} j={j} />
        ))}
      </div>
    </Panel>
  ) : null;

  /* Las tareas de LA IDEA van con su clave; si ninguna clave cubre su fase, en la propia franja (no se pierden). */
  const principal = inf.sintesis.consigna[0] ?? "";
  const lineaIdea = inf.sintesis.plan.find((l) => principal && (l.texto === principal || l.texto.startsWith(`${principal}:`) || l.texto.startsWith(`${principal} `)));
  const cubierta = Boolean(lineaIdea && (inf.plan?.claves ?? []).slice(0, 3).some((c) => claveDeFase([c], lineaIdea.fase) === 1));
  /* LA IDEA que sale de un duelo (no es línea del plan) lleva las tareas de su consigna (25/10/2026). */
  const tareasIdea = lineaIdea ? (!cubierta ? tareasDeLinea(inf, lineaIdea.texto) : []) : (inf.sintesis.consignaTareas.find((c) => c.consigna === principal)?.tareas ?? []);

  const cierre = (inf.plan?.claves ?? []).length ? cierrePrevia(inf) : "";

  return (
    <Marco pagina={3} total={3} etiqueta="CÓMO LO GANAMOS" inf={inf}>
      {idea ? (
        <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "14px 26px", marginBottom: 18, borderRadius: 18, background: "linear-gradient(90deg, rgba(200,169,107,0.22), rgba(200,169,107,0.04))", border: "2px solid rgba(200,169,107,0.45)" }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.24em", color: C.oro, whiteSpace: "nowrap" }}>LA IDEA</span>
          <span style={{ width: 2, alignSelf: "stretch", background: "rgba(200,169,107,0.5)" }} />
          <span style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: C.crema }}>{idea}</span>
          {tareasIdea.length ? <span style={{ marginLeft: "auto", fontSize: 17, fontWeight: 600, color: C.suave, whiteSpace: "nowrap" }}>→ {tareasIdea.join(" · ")}</span> : null}
        </div>
      ) : null}
      {/* Sin semana registrada, dos columnas a la derecha (a vigilar · balón parado) en vez de un hueco vacío. */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1.25fr 0.95fr 0.95fr", gap: 22 }}>
        <Panel titulo="CÓMO LO GANAMOS">
          <PlanConTareas inf={inf} />
          {glosario(inf.sintesis.plan.map((l) => l.texto)) ? <div style={{ paddingTop: 12, fontSize: 15, color: C.tenue }}>{glosario(inf.sintesis.plan.map((l) => l.texto))}</div> : null}
        </Panel>

        {semana ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 22, minHeight: 0 }}>
              {panelVigilar}
              <PanelAbp inf={inf} />
            </div>
            <Panel titulo="LA SEMANA">
              <Semana inf={inf} />
            </Panel>
          </>
        ) : (
          <>
            {panelVigilar ?? <div />}
            <PanelAbp inf={inf} />
          </>
        )}
      </div>
      {/* La última línea de la previa: las claves dichas como se dicen en la charla (24/10/2026, guion: acababa en una tabla). */}
      {cierre ? <div style={{ marginTop: 16, fontSize: 26, fontWeight: 700, lineHeight: 1.15, color: C.oroClaro, textAlign: "center" }}>{cierre}</div> : null}
    </Marco>
  );
}

export function Diapositivas({ inf }: { inf: InformePartido }) {
  return inf.momento === "post" ? (
    <>
      <PostResultado inf={inf} />
      <PostLecciones inf={inf} />
      <DuelosYRival inf={inf} />
    </>
  ) : (
    <>
      <PreviaRival inf={inf} />
      <PreviaDondeEsta inf={inf} />
      <PreviaComoGanamos inf={inf} />
    </>
  );
}

/** Una diapositiva escalada para la vista previa. */
export function Escalada({ ancho, children }: { ancho: number; children: ReactNode }) {
  const escala = ancho / DIAPO_W;

  return (
    <div style={{ width: ancho, height: DIAPO_H * escala, position: "relative", overflow: "hidden", borderRadius: 12 }}>
      <div style={{ transform: `scale(${escala})`, transformOrigin: "top left", position: "absolute", inset: 0 }}>{children}</div>
    </div>
  );
}

export const DIAPOSITIVAS = {
  previa: [PreviaRival, PreviaDondeEsta, PreviaComoGanamos],
  post: [PostResultado, PostLecciones, DuelosYRival],
} as const;
