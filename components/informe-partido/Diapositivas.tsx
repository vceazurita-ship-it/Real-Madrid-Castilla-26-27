"use client";

/**
 * EL RESUMEN DEL PARTIDO EN DOS DIAPOSITIVAS (03/10/2026).
 *
 * Lo que se lee en el móvil antes de entrar al vestuario: dos láminas de
 * 1920×1080, iguales en pantalla, en el correo y en el PDF.
 *
 *   PREVIA · 1 «El partido»: quién es, cómo llega, el duelo en datos y su once.
 *   PREVIA · 2 «El plan»: las claves, a quién vigilar, la semana y los tres
 *               momentos (con balón, sin balón, ABP).
 *   POST   · 1 «El resultado»: marcador y el partido en datos, nosotros y ellos.
 *   POST   · 2 «Lo que nos deja»: lo que se salió de lo habitual, el plan a
 *               revisión y la semana que lo preparó.
 *
 * Todo en estilos en línea (hex y rgba): `html-to-image` serializa el estilo
 * calculado y ni `oklch` ni `backdrop-filter` sobreviven al JPEG.
 */

import type { CSSProperties, ReactNode } from "react";

import { apellido, cifra, conDato, fraseUtil, ordinal, pct, revisaPalancas, type GolCronica, type InformePartido, type JugadorRival, type MetricaDuelo, type Probabilidades } from "@/lib/informe-partido/modelo";

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

const recorta = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

function Marco({ children, pagina, total, etiqueta, inf }: { children: ReactNode; pagina: number; total: number; etiqueta: string; inf: InformePartido }) {
  const p = inf.partido;

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
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "0.14em", color: C.suave }}>
              {inf.momento === "post" ? "POST PARTIDO" : "PREVIA DEL PARTIDO"}
              {p.jornada ? ` · JORNADA ${p.jornada}` : ""}
              {inf.microciclo ? ` · MICROCICLO ${inf.microciclo.micro}` : ""}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "0.08em", color: C.suave, textTransform: "uppercase" }}>{p.fechaTexto}</div>
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
      {!resultados.length && <span style={{ fontSize: 20, color: C.tenue }}>Sin datos</span>}
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
        {m.nombre}
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

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, height: "100%", aspectRatio: "1.12", maxWidth: "100%", margin: "0 auto", borderRadius: 18, overflow: "hidden", background: "repeating-linear-gradient(180deg, #133A27 0 10%, #10301F 10% 20%)", border: "2px solid rgba(255,255,255,0.12)" }}>
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
          <div key={j.clave} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: 118, transform: "translate(-50%, -24px)", textAlign: "center" }}>
            <div
              style={{
                width: 46,
                height: 46,
                margin: "0 auto",
                borderRadius: 999,
                background: resaltar?.has(j.clave) ? C.oro : C.rival,
                border: "3px solid #fff",
                color: "#fff",
                fontSize: 22,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {j.dorsal || ""}
            </div>
            <div style={{ marginTop: 3, fontSize: 18, fontWeight: 700, color: "#fff", textTransform: "uppercase", textShadow: "0 1px 3px rgba(0,0,0,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {j.nombre.split(" ").slice(-1)[0]}
            </div>
          </div>
        );
      })}
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
      {!items.length && <span style={{ fontSize: 24, color: C.tenue }}>Sin datos todavía.</span>}
    </div>
  );
}

function Semana({ inf }: { inf: InformePartido }) {
  const m = inf.microciclo;

  if (!m) return <span style={{ fontSize: 24, color: C.tenue }}>Sin tareas en la hoja de registro.</span>;

  const max = Math.max(1, ...m.dias.map((d) => d.minutos));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flex: 1, minHeight: 0, paddingBottom: 6 }}>
        {m.dias.map((d) => (
          <div key={d.fecha} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: C.crema }}>{d.minutos}′</span>
            <div style={{ width: "70%", height: `${Math.max(6, (d.minutos / max) * 72)}%`, borderRadius: 10, background: d.esPartido ? C.rival : C.oro, marginTop: 6 }} />
            <span style={{ marginTop: 8, fontSize: 19, fontWeight: 700, color: C.suave }}>{d.md || d.etiqueta}</span>
            <span style={{ fontSize: 16, color: C.tenue }}>{d.etiqueta}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 22, marginTop: 10, fontSize: 21, fontWeight: 600, color: C.suave }}>
        <span>
          <b style={{ color: C.crema, fontSize: 28 }}>{m.totales.minutos}′</b> de trabajo
        </span>
        {m.totales.abpMinutos > 0 && (
          <span>
            <b style={{ color: C.crema, fontSize: 28 }}>{m.totales.abpMinutos}′</b> de ABP
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

/** Las dos métricas que mejor cuentan cada bloque (las primeras con dato de los dos). */
function metricasPorBloque(inf: InformePartido, porBloque = 2) {
  const todas = (inf.duelo?.metricas ?? []).filter((m) => m.nosotros && m.rival && conDato(m));

  return BLOQUES.map((b) => ({ bloque: b, metricas: todas.filter((m) => m.bloque === b).slice(0, porBloque) })).filter((x) => x.metricas.length);
}

/** Los dos en datos, por bloques: nosotros a la izquierda, ellos a la derecha. */
function DatosPorBloques({ inf, porBloque = 2 }: { inf: InformePartido; porBloque?: number }) {
  const grupos = metricasPorBloque(inf, porBloque);

  const ellos = inf.partido.rival.toUpperCase();

  if (!grupos.length) return <span style={{ fontSize: 24, color: C.tenue }}>Data Análisis aún no tiene partidos del rival.</span>;

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

/** El pronóstico: qué partido es, en números. */
function PanelPronostico({ inf }: { inf: InformePartido }) {
  const pr = inf.pronostico;

  return (
    <Panel titulo="EL PRONÓSTICO">
      {pr ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 18 }}>
          <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.05, color: C.crema }}>{pr.lectura.split(":")[0]}</div>
          <BarraResultado p={pr} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Cifra rotulo="GOLES ESPERADOS" valor={`${cifra(pr.esperados.nosotros, "decimal")} – ${cifra(pr.esperados.rival, "decimal")}`} />
            <Cifra rotulo="MARCADOR MÁS PROBABLE" valor={pr.marcador} />
          </div>
          {inf.sintesis.ventajas[0] || inf.sintesis.amenazas[0] ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {inf.sintesis.ventajas[0] ? (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.18em", color: C.bien }}>DONDE GANAMOS EL CRUCE</div>
                  <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.15, color: C.crema }}>{recorta(inf.sintesis.ventajas[0], 80)}</div>
                </div>
              ) : null}
              {inf.sintesis.amenazas[0] ? (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.18em", color: C.rival }}>DONDE NOS PUEDEN HACER DAÑO</div>
                  <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.15, color: C.crema }}>{recorta(inf.sintesis.amenazas[0], 80)}</div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div style={{ marginTop: "auto", padding: "14px 18px", borderRadius: 16, background: "rgba(200,169,107,0.12)", border: "2px solid rgba(200,169,107,0.4)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.18em", color: C.oro }}>CON EL PLAN BIEN HECHO</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
              <span style={{ fontSize: 26, fontWeight: 600, color: C.suave, textDecoration: "line-through" }}>{pct(pr.victoria)}</span>
              <span style={{ fontSize: 26, color: C.oro }}>→</span>
              <span style={{ fontSize: 54, fontWeight: 700, color: C.oro, lineHeight: 1 }}>{pct(pr.conPlan.victoria)}</span>
              <span style={{ fontSize: 22, fontWeight: 600, color: C.suave }}>de victoria</span>
            </div>
          </div>
          <div style={{ fontSize: 15, color: C.tenue }}>{pr.base}</div>
        </div>
      ) : (
        <span style={{ fontSize: 24, color: C.tenue }}>Sin datos de los dos en Data Análisis: no hay pronóstico.</span>
      )}
    </Panel>
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

function PreviaPartido({ inf }: { inf: InformePartido }) {
  const ctx = inf.contexto;

  const nosotros = "RM CASTILLA";
  const ellos = inf.partido.rival.toUpperCase();

  const [local, visitante] = inf.partido.lado === "fuera" ? [ellos, nosotros] : [nosotros, ellos];

  return (
    <Marco pagina={1} total={2} etiqueta="EL PARTIDO" inf={inf}>
      {/* El cartel */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40 }}>
        <Escudo src={inf.partido.lado === "fuera" ? ctx?.escudo ?? "" : ctx?.escudoNuestro ?? ""} size={84} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 0.95, letterSpacing: "0.01em" }}>
            {local} <span style={{ color: C.oro }}>·</span> {visitante}
          </div>
          <div style={{ marginTop: 6, fontSize: 24, fontWeight: 600, letterSpacing: "0.1em", color: C.suave }}>{inf.sintesis.titular.toUpperCase()}</div>
        </div>
        <Escudo src={inf.partido.lado === "fuera" ? ctx?.escudoNuestro ?? "" : ctx?.escudo ?? ""} size={84} />
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1.3fr 0.9fr 1fr", gap: 22, marginTop: 18 }}>
        <Panel titulo="LOS DOS EN DATOS">
          <DatosPorBloques inf={inf} />
          {inf.duelo && (
            <div style={{ marginTop: 6, fontSize: 15, color: C.tenue }}>
              Wyscout {inf.duelo.temporada} · media por partido y puesto entre {inf.duelo.equipos} · barra = percentil (larga = mejor)
            </div>
          )}
        </Panel>

        <PanelPronostico inf={inf} />

        <Panel titulo={inf.once.fuente === "marcado" ? "SU ONCE PROBABLE" : "SU ÚLTIMO ONCE"} acento={C.rival}>
          {inf.once.jugadores.length ? <Campo once={inf.once.jugadores} /> : <span style={{ fontSize: 24, color: C.tenue }}>Sin once.</span>}
          <div style={{ marginTop: 8, fontSize: 18, color: C.tenue, textAlign: "center" }}>
            {[inf.duelo?.esquema.rival && `Dibujo más usado: ${inf.duelo.esquema.rival}`, ctx?.entrenador && `Entrenador: ${ctx.entrenador}`].filter(Boolean).join(" · ")}
          </div>
        </Panel>
      </div>

      <Pie inf={inf} />
    </Marco>
  );
}

const rasgosDe = (j: JugadorRival) =>
  [j.goles ? `${j.goles} ${j.goles === 1 ? "gol" : "goles"}` : "", j.asistencias ? `${j.asistencias} ${j.asistencias === 1 ? "asistencia" : "asist."}` : "", ...j.rasgos.slice(0, 2)]
    .filter(Boolean)
    .join(" · ") || recorta(j.fortalezas.split(/\n/)[0] ?? "", 60);

/** A quién vigilar, en una fila: dorsal, nombre y por qué. */
function VigilarFila({ j }: { j: JugadorRival }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: C.rival, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{j.dorsal || "·"}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.05, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {j.nombre} <span style={{ fontSize: 17, fontWeight: 600, color: C.tenue, textTransform: "none" }}>{j.posicion.toLowerCase()}</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.oroClaro, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rasgosDe(j)}</div>
      </div>
    </div>
  );
}

/** Cómo juega el rival: una línea por momento y dónde hacerles daño. */
function PanelSuJuego({ inf }: { inf: InformePartido }) {
  const r = inf.colectivo?.resumen;

  return (
    <Panel titulo="CÓMO JUEGAN" acento={C.rival}>
      {r?.fases.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {r.fases.map((f) => (
            <div key={f.titulo}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.rival }}>{f.titulo.toUpperCase()}</div>
              <div style={{ fontSize: 21, fontWeight: 600, lineHeight: 1.15, color: C.crema }}>{recorta(f.texto, 96)}</div>
            </div>
          ))}
        </div>
      ) : (
        <span style={{ fontSize: 21, color: C.tenue }}>Sin análisis colectivo en Scouting colectivo.</span>
      )}

      {r?.dano.length ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.bien }}>DÓNDE HACERLES DAÑO</div>
          {r.dano.slice(0, 2).map((t) => (
            <div key={t} style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.15, color: C.crema, marginTop: 4 }}>
              <span style={{ color: C.bien }}>▸ </span>
              {recorta(t, 92)}
            </div>
          ))}
        </div>
      ) : null}

      {inf.sintesis.vigilar.length ? (
        <div style={{ marginTop: "auto", paddingTop: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.rival, marginBottom: 8 }}>A VIGILAR</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {inf.sintesis.vigilar.map((j) => (
              <VigilarFila key={j.clave} j={j} />
            ))}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

/** Lo esencial del informe de ABP de la semana. */
function PanelAbp({ inf, titulo = "BALÓN PARADO" }: { inf: InformePartido; titulo?: string }) {
  const p = inf.abp?.pincelada;

  const plan = fraseUtil(inf.plan?.abpOf, 90);
  const planDef = fraseUtil(inf.plan?.abpDef, 90);

  return (
    <Panel titulo={titulo}>
      {p ? (
        <>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, color: C.crema }}>{recorta(p.titular, 90)}</div>
          {p.cifras.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              {p.cifras.slice(0, 4).map((c) => (
                <div key={c.rotulo} style={{ padding: "8px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: `2px solid ${C.borde}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", color: C.tenue, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.rotulo}</div>
                  <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.05, color: C.oro }}>{c.valor}</div>
                  {c.pie ? <div style={{ fontSize: 14, color: C.tenue, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.pie}</div> : null}
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {p.claves.slice(0, 2).map((t) => (
              <div key={t} style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.15, color: C.crema }}>
                <span style={{ color: C.oro }}>▸ </span>
                {recorta(t, 96)}
              </div>
            ))}
            {p.rival.slice(0, 1).map((t) => (
              <div key={t} style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.15, color: C.crema }}>
                <span style={{ color: C.rival }}>▸ </span>
                {recorta(t, 96)}
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
          <div style={{ fontSize: 17, color: C.tenue }}>
            {inf.abp?.laminasRival ? `${inf.abp.laminasRival} láminas del rival preparadas · ` : ""}el informe de ABP de la semana no ha llegado.
          </div>
        </div>
      )}
    </Panel>
  );
}

/** Las tres palancas: cómo el plan mueve el pronóstico. */
function Palancas({ inf }: { inf: InformePartido }) {
  const pr = inf.pronostico;

  if (!pr) return null;

  return (
    <div style={{ marginTop: "auto", paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.oro }}>EL PLAN MUEVE EL PRONÓSTICO</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: C.crema, whiteSpace: "nowrap" }}>
          {pct(pr.victoria)} <span style={{ color: C.oro }}>→ {pct(pr.conPlan.victoria)}</span>
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pr.palancas.map((p) => (
          <div key={p.momento} style={{ display: "flex", gap: 14, padding: "10px 14px", borderRadius: 14, background: "rgba(200,169,107,0.07)", border: "2px solid rgba(200,169,107,0.22)" }}>
            <div style={{ width: 82, flexShrink: 0, textAlign: "center" }}>
              <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, color: C.oro }}>+{Math.max(0, p.victoria)}</div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: C.tenue }}>PTS VICTORIA</div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.18em", color: C.oro }}>{p.momento.toUpperCase()}</div>
              <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.1, color: C.crema }}>{p.objetivo}</div>
              {p.plan ? <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.15, color: C.suave }}>Plan: {recorta(p.plan, 80)}</div> : null}
              <div style={{ fontSize: 15, lineHeight: 1.15, color: C.tenue }}>{recorta(p.porque, 90)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviaPlan({ inf }: { inf: InformePartido }) {
  return (
    <Marco pagina={2} total={2} etiqueta="EL PLAN" inf={inf}>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1.15fr 1fr 0.95fr", gap: 22 }}>
        <Panel titulo="CÓMO LO GANAMOS">
          <Lista items={inf.sintesis.claves} numerada tamano={27} max={4} corte={100} />
          <Palancas inf={inf} />
        </Panel>

        <PanelSuJuego inf={inf} />

        <div style={{ display: "flex", flexDirection: "column", gap: 22, minHeight: 0 }}>
          <PanelAbp inf={inf} />
          <Panel titulo="LA SEMANA" style={{ flex: 1 }}>
            <Semana inf={inf} />
          </Panel>
        </div>
      </div>
    </Marco>
  );
}

function PostResultado({ inf }: { inf: InformePartido }) {
  const p = inf.partido;

  const cronica = inf.cronica;

  const metricas = (inf.duelo?.partido?.metricas ?? []).filter((m) => m.nuestro !== null && m.suyo !== null).slice(0, cronica?.goles.length ? 7 : 9);

  /* Con la línea de goles el panel tiene menos alto: dos filas menos. */
  const temporada = (inf.duelo?.metricas ?? []).filter((m) => m.nosotros && m.rival && conDato(m)).slice(0, cronica?.goles.length ? 6 : 8);

  const real = cronica?.onceReal ?? [];

  const acierto = cronica?.acierto ?? null;

  const sorpresas = new Set(real.filter((r) => acierto?.sorpresas.includes(r.nombre)).map((r) => r.clave));

  const marcador = p.gf !== null && p.gc !== null ? (p.lado === "fuera" ? `${p.gc} - ${p.gf}` : `${p.gf} - ${p.gc}`) : "—";

  const [local, visitante] = p.lado === "fuera" ? [p.rival.toUpperCase(), "RM CASTILLA"] : ["RM CASTILLA", p.rival.toUpperCase()];

  return (
    <Marco pagina={1} total={2} etiqueta="EL RESULTADO" inf={inf}>
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
      <div style={{ textAlign: "center", fontSize: 26, fontWeight: 600, letterSpacing: "0.1em", color: C.suave, marginTop: 4 }}>{inf.sintesis.titular.toUpperCase()}</div>

      {cronica?.goles.length ? <LineaGoles goles={cronica.goles} /> : null}

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 26, marginTop: cronica?.goles.length ? 8 : 22 }}>
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
                <FilaDuelo key={m.key} m={m} equipos={inf.duelo?.equipos ?? 0} />
              ))}
            </div>
            {inf.pronostico ? (
              <div style={{ marginTop: 8, fontSize: 18, color: C.suave }}>
                El pronóstico daba <b style={{ color: C.oro }}>{pct(inf.pronostico.victoria)}</b> de victoria, {pct(inf.pronostico.empate)} de empate y {pct(inf.pronostico.derrota)} de derrota.
              </div>
            ) : null}
            <div style={{ marginTop: 8, fontSize: 18, color: C.tenue }}>
              Wyscout aún no tiene este partido (se baja los martes o desde Ajustes): medias de la temporada hasta la jornada.
            </div>
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

                return (
                  <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 110, textAlign: "right", fontSize: 30, fontWeight: 700 }}>{cifra(m.nuestro, m.unidad)}</span>
                    <div style={{ flex: 1, height: 20, display: "flex", justifyContent: "flex-end", background: "rgba(255,255,255,0.05)", borderRadius: 10 }}>
                      <div style={{ width: `${(Math.abs(m.nuestro ?? 0) / tope) * 100}%`, background: C.oro, borderRadius: 10 }} />
                    </div>
                    <span style={{ width: 300, textAlign: "center", fontSize: 21, fontWeight: 700, color: C.suave, textTransform: "uppercase" }}>{m.nombre}</span>
                    <div style={{ flex: 1, height: 20, background: "rgba(255,255,255,0.05)", borderRadius: 10 }}>
                      <div style={{ width: `${(Math.abs(m.suyo ?? 0) / tope) * 100}%`, height: "100%", background: C.rival, borderRadius: 10 }} />
                    </div>
                    <span style={{ width: 110, fontSize: 30, fontWeight: 700 }}>{cifra(m.suyo, m.unidad)}</span>
                  </div>
                );
              })}
              {!metricas.length && (
                <span style={{ fontSize: 26, color: C.tenue }}>Wyscout todavía no tiene este partido: se baja los martes (o desde Ajustes).</span>
              )}
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
          ) : (
            <span style={{ fontSize: 24, color: C.tenue }}>Sin once.</span>
          )}
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

function PostLecciones({ inf }: { inf: InformePartido }) {
  const pr = inf.pronostico;

  const p = inf.partido;

  const real = p.gf !== null && p.gc !== null ? (p.gf > p.gc ? "victoria" : p.gf < p.gc ? "derrota" : "empate") : undefined;

  const crecer = (inf.duelo?.metricas ?? [])
    .filter((m) => m.mejorAlto !== null && m.nosotros && conDato(m) && m.nosotros.puesto > (inf.duelo?.equipos ?? 20) * 0.6)
    .slice(0, 2)
    .map((m) => `${m.nombre}: ${cifra(m.nosotros!.valor, m.unidad)} (${ordinal(m.nosotros!.puesto)} de ${inf.duelo?.equipos ?? 20})`);

  const palancas = revisaPalancas(inf);

  return (
    <Marco pagina={2} total={2} etiqueta="LO QUE NOS DEJA" inf={inf}>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1.15fr 1fr 0.95fr", gap: 22 }}>
        <Panel titulo="EL PLAN, A REVISIÓN">
          {pr ? (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.oro, marginBottom: 6 }}>EL PRONÓSTICO, FRENTE AL RESULTADO</div>
              <BarraResultado p={pr} alto={46} resaltar={real} />
              {inf.sintesis.veredicto ? <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.15, color: C.crema, marginTop: 6 }}>{recorta(inf.sintesis.veredicto, 130)}</div> : null}
            </div>
          ) : null}
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.tenue, marginBottom: 6 }}>LO QUE NOS PROPUSIMOS · ¿SE CUMPLIÓ?</div>
          <Lista items={inf.plan?.claves ?? []} numerada tamano={23} max={3} corte={100} />
          {palancas.length ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.oro, marginBottom: 6 }}>¿MOVIMOS LAS PALANCAS?</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {palancas.map((x) => (
                  <div key={x.momento} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 19, fontWeight: 600, whiteSpace: "nowrap", minWidth: 0 }}>
                    <span style={{ width: 26, height: 26, borderRadius: 999, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#08111F", background: x.cumplida === null ? C.neutro : x.cumplida ? C.bien : C.mal }}>
                      {x.cumplida === null ? "·" : x.cumplida ? "✓" : "✗"}
                    </span>
                    <span style={{ color: C.oro, width: 112, flexShrink: 0, fontWeight: 700 }}>{x.momento}</span>
                    <span style={{ color: C.crema, flexShrink: 0 }}>{x.meta}</span>
                    <span style={{ color: C.tenue, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>· {x.real}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {inf.sintesis.frenados.length > 0 ? (
            <div style={{ marginTop: "auto", paddingTop: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.rival, marginBottom: 8 }}>¿LOS FRENAMOS?</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {inf.sintesis.frenados.map((f) => (
                  <div key={f.jugador.clave} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 999, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#08111F", background: f.bien ? C.bien : C.mal }}>{f.bien ? "✓" : "!"}</span>
                    <div style={{ minWidth: 0, fontSize: 21, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {f.jugador.nombre} <span style={{ fontSize: 17, fontWeight: 600, color: C.suave, textTransform: "none" }}>{f.texto}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Panel>

        <Panel titulo="LO QUE NOS DEJA">
          {inf.sintesis.relato.length ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.oro, marginBottom: 6 }}>CÓMO FUE</div>
              {inf.sintesis.relato.map((t) => (
                <div key={t} style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.25, color: C.crema }}>
                  <span style={{ color: C.oro }}>▸ </span>
                  {t}
                </div>
              ))}
            </div>
          ) : null}
          <Lista items={inf.sintesis.claves} tamano={22} max={4} corte={120} />
          {crecer.length ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.rival, margin: "20px 0 8px" }}>DONDE HAY QUE CRECER</div>
              <Lista items={crecer} tamano={22} max={2} />
            </>
          ) : null}
          {inf.contexto?.nuestroPuesto ? (
            <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontSize: 64, fontWeight: 700, color: C.oro, lineHeight: 1 }}>{ordinal(inf.contexto.nuestroPuesto)}</span>
              <span style={{ fontSize: 24, fontWeight: 600, color: C.suave }}>en la clasificación · {inf.contexto.nuestrosPuntos} pts</span>
            </div>
          ) : null}
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, minHeight: 0 }}>
          <PanelAbp inf={inf} titulo="BALÓN PARADO DEL PARTIDO" />
          <Panel titulo="LA SEMANA QUE LO PREPARÓ" style={{ flex: 1 }}>
            <Semana inf={inf} />
          </Panel>
        </div>
      </div>
    </Marco>
  );
}

export function Diapositivas({ inf }: { inf: InformePartido }) {
  return inf.momento === "post" ? (
    <>
      <PostResultado inf={inf} />
      <PostLecciones inf={inf} />
    </>
  ) : (
    <>
      <PreviaPartido inf={inf} />
      <PreviaPlan inf={inf} />
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
  previa: [PreviaPartido, PreviaPlan],
  post: [PostResultado, PostLecciones],
} as const;
