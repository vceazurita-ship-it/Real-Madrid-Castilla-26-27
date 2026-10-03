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

import { cifra, ordinal, type InformePartido, type JugadorRival, type MetricaDuelo } from "@/lib/informe-partido/modelo";

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

function Forma({ titulo, lista, derecha = false }: { titulo: string; lista: { gf: number; gc: number }[]; derecha?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexDirection: derecha ? "row-reverse" : "row" }}>
      <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.16em", color: C.tenue, textAlign: derecha ? "left" : "right" }}>
        {titulo}
        <br />
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.08em" }}>ÚLTIMOS 5</span>
      </span>
      {lista.slice(0, 5).map((p, i) => {
        const r = p.gf > p.gc ? "G" : p.gf < p.gc ? "P" : "E";

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
      {!lista.length && <span style={{ fontSize: 20, color: C.tenue }}>Sin datos</span>}
    </div>
  );
}

/** Una métrica, nosotros a la izquierda y ellos a la derecha, por percentil. */
function FilaDuelo({ m, equipos }: { m: MetricaDuelo; equipos: number }) {
  const ancho = 290;

  const lado = (dato: MetricaDuelo["nosotros"], color: string, alinear: "left" | "right") => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexDirection: alinear === "left" ? "row-reverse" : "row", width: ancho + 150 }}>
      <div style={{ width: ancho, height: 22, borderRadius: 11, background: "rgba(255,255,255,0.06)", position: "relative", overflow: "hidden" }}>
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
      <div style={{ width: 138, textAlign: alinear === "left" ? "right" : "left" }}>
        <span style={{ fontSize: 30, fontWeight: 700, color: C.crema }}>{cifra(dato?.valor ?? null, m.unidad)}</span>
        <span style={{ fontSize: 19, fontWeight: 600, color: C.tenue, marginLeft: 6, marginRight: 6 }}>{dato ? ordinal(dato.puesto) : ""}</span>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      {lado(m.nosotros, C.oro, "left")}
      <div style={{ flex: 1, textAlign: "center", fontSize: 22, fontWeight: 700, letterSpacing: "0.06em", color: C.suave, textTransform: "uppercase" }}>
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
function Campo({ once }: { once: JugadorRival[] }) {
  const linea = "2px solid rgba(255,255,255,0.22)";

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, height: "100%", aspectRatio: "0.82", margin: "0 auto", borderRadius: 18, overflow: "hidden", background: "repeating-linear-gradient(180deg, #133A27 0 10%, #10301F 10% 20%)", border: "2px solid rgba(255,255,255,0.12)" }}>
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
          <div key={j.clave} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: 128, transform: "translate(-50%, -24px)", textAlign: "center" }}>
            <div
              style={{
                width: 46,
                height: 46,
                margin: "0 auto",
                borderRadius: 999,
                background: C.rival,
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
            <div style={{ marginTop: 4, fontSize: 19, fontWeight: 700, color: "#fff", textTransform: "uppercase", textShadow: "0 1px 3px rgba(0,0,0,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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

function PreviaPartido({ inf }: { inf: InformePartido }) {
  const ctx = inf.contexto;

  const metricas = (inf.duelo?.metricas ?? []).filter((m) => m.nosotros && m.rival).slice(0, 8);

  const nosotros = "RM CASTILLA";
  const ellos = inf.partido.rival.toUpperCase();

  const [local, visitante] = inf.partido.lado === "fuera" ? [ellos, nosotros] : [nosotros, ellos];

  return (
    <Marco pagina={1} total={2} etiqueta="EL PARTIDO" inf={inf}>
      {/* El cartel */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 46 }}>
        <Escudo src={inf.partido.lado === "fuera" ? ctx?.escudo ?? "" : ctx?.escudoNuestro ?? ""} size={92} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 0.95, letterSpacing: "0.01em" }}>
            {local} <span style={{ color: C.oro }}>·</span> {visitante}
          </div>
          <div style={{ marginTop: 8, fontSize: 26, fontWeight: 600, letterSpacing: "0.1em", color: C.suave }}>{inf.sintesis.titular.toUpperCase()}</div>
        </div>
        <Escudo src={inf.partido.lado === "fuera" ? ctx?.escudoNuestro ?? "" : ctx?.escudo ?? ""} size={92} />
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 26, marginTop: 22 }}>
        <Panel titulo="DUELO EN DATOS">
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 21, fontWeight: 700, letterSpacing: "0.16em", marginBottom: 10 }}>
            <span style={{ color: C.oro }}>NOSOTROS · PUESTO EN LA LIGA</span>
            <span style={{ color: C.rival }}>{ellos}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
            {metricas.map((m) => (
              <FilaDuelo key={m.key} m={m} equipos={inf.duelo?.equipos ?? 0} />
            ))}
            {!metricas.length && <span style={{ fontSize: 26, color: C.tenue }}>Data Análisis aún no tiene partidos del rival.</span>}
          </div>
          {inf.duelo && (
            <div style={{ marginTop: 10, fontSize: 18, color: C.tenue }}>
              Wyscout · temporada {inf.duelo.temporada} · la barra es el percentil en la liga (larga = mejor) · {inf.duelo.jugados.nosotros} y {inf.duelo.jugados.rival} partidos
            </div>
          )}
        </Panel>

        <Panel titulo={inf.once.fuente === "marcado" ? "SU ONCE PROBABLE" : "SU ÚLTIMO ONCE"} acento={C.rival}>
          {inf.once.jugadores.length ? <Campo once={inf.once.jugadores} /> : <span style={{ fontSize: 24, color: C.tenue }}>Sin once.</span>}
          <div style={{ marginTop: 10, fontSize: 19, color: C.tenue, textAlign: "center" }}>
            {[inf.duelo?.esquema.rival && `Dibujo más usado: ${inf.duelo.esquema.rival}`, ctx?.entrenador && `Entrenador: ${ctx.entrenador}`].filter(Boolean).join(" · ")}
          </div>
        </Panel>
      </div>

      <Pie inf={inf} />
    </Marco>
  );
}

function TarjetaJugador({ j }: { j: JugadorRival }) {
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", padding: "14px 16px", borderRadius: 18, background: "rgba(232,106,90,0.08)", border: "2px solid rgba(232,106,90,0.22)" }}>
      <div style={{ width: 70, height: 70, borderRadius: 16, background: C.rival, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{j.dorsal || "·"}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.nombre}</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: C.suave, marginTop: 4 }}>
          {[j.posicion, j.pie && `pie ${j.pie.toLowerCase()}`, j.altura].filter(Boolean).join(" · ")}
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, color: C.oroClaro, marginTop: 4 }}>
          {[j.goles ? `${j.goles} ${j.goles === 1 ? "gol" : "goles"}` : "", j.asistencias ? `${j.asistencias} ${j.asistencias === 1 ? "asistencia" : "asist."}` : "", ...j.rasgos.slice(0, 2)].filter(Boolean).join(" · ") || recorta(j.fortalezas.split(/\n/)[0] ?? "", 60)}
        </div>
      </div>
    </div>
  );
}

function Momento3({ inf }: { inf: InformePartido }) {
  const p = inf.plan;

  const primera = (t: string | undefined) => recorta((t ?? "").split(/\r?\n|(?<=\.)\s/)[0]?.trim() ?? "", 110);

  const items = [
    { titulo: "CON BALÓN", texto: primera(p?.ataque) },
    { titulo: "SIN BALÓN", texto: primera(p?.defensa) },
    { titulo: "BALÓN PARADO", texto: primera(p?.abpOf || p?.abpDef) },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginTop: 20 }}>
      {items.map((i) => (
        <div key={i.titulo} style={{ padding: "16px 22px", borderRadius: 18, background: "rgba(200,169,107,0.08)", border: "2px solid rgba(200,169,107,0.25)", minHeight: 110 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.18em", color: C.oro }}>{i.titulo}</div>
          <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, marginTop: 6, color: i.texto ? C.crema : C.tenue }}>{i.texto || "Sin escribir en el plan de partido."}</div>
        </div>
      ))}
    </div>
  );
}

function PreviaPlan({ inf }: { inf: InformePartido }) {
  return (
    <Marco pagina={2} total={2} etiqueta="EL PLAN" inf={inf}>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1.25fr 1fr 1fr", gap: 24 }}>
        <Panel titulo="CLAVES DEL PARTIDO">
          <Lista items={inf.sintesis.claves} numerada tamano={31} corte={110} />
          {inf.sintesis.ventajas.length > 0 && (
            <div style={{ marginTop: "auto", paddingTop: 16 }}>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "0.16em", color: C.bien }}>DONDE SOMOS MEJORES</div>
              <div style={{ fontSize: 21, fontWeight: 600, color: C.suave, marginTop: 4 }}>{recorta(inf.sintesis.ventajas[0], 90)}</div>
            </div>
          )}
        </Panel>

        <Panel titulo="A VIGILAR" acento={C.rival}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {inf.sintesis.vigilar.map((j) => (
              <TarjetaJugador key={j.clave} j={j} />
            ))}
            {!inf.sintesis.vigilar.length && <span style={{ fontSize: 24, color: C.tenue }}>Sin plantilla del rival.</span>}
          </div>
          {inf.sintesis.amenazas.length > 0 && (
            <div style={{ marginTop: "auto", paddingTop: 16 }}>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "0.16em", color: C.rival }}>DONDE SON FUERTES</div>
              <div style={{ fontSize: 21, fontWeight: 600, color: C.suave, marginTop: 4 }}>{recorta(inf.sintesis.amenazas[0], 90)}</div>
            </div>
          )}
        </Panel>

        <Panel titulo="LA SEMANA">
          <Semana inf={inf} />
        </Panel>
      </div>

      <Momento3 inf={inf} />
    </Marco>
  );
}

function PostResultado({ inf }: { inf: InformePartido }) {
  const p = inf.partido;

  const metricas = (inf.duelo?.partido?.metricas ?? []).filter((m) => m.nuestro !== null && m.suyo !== null).slice(0, 9);

  const temporada = (inf.duelo?.metricas ?? []).filter((m) => m.nosotros && m.rival).slice(0, 8);

  const marcador = p.gf !== null && p.gc !== null ? (p.lado === "fuera" ? `${p.gc} - ${p.gf}` : `${p.gf} - ${p.gc}`) : "—";

  const [local, visitante] = p.lado === "fuera" ? [p.rival.toUpperCase(), "RM CASTILLA"] : ["RM CASTILLA", p.rival.toUpperCase()];

  return (
    <Marco pagina={1} total={2} etiqueta="EL RESULTADO" inf={inf}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 22, minWidth: 600 }}>
          <span style={{ fontSize: 58, fontWeight: 700 }}>{local}</span>
          <Escudo src={(p.lado === "fuera" ? inf.contexto?.escudo : inf.contexto?.escudoNuestro) ?? ""} size={78} />
        </div>
        <div style={{ fontSize: 120, fontWeight: 700, color: C.oro, lineHeight: 1, padding: "0 30px", borderRadius: 26, background: "rgba(200,169,107,0.1)" }}>{marcador}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 22, minWidth: 600 }}>
          <Escudo src={(p.lado === "fuera" ? inf.contexto?.escudoNuestro : inf.contexto?.escudo) ?? ""} size={78} />
          <span style={{ fontSize: 58, fontWeight: 700 }}>{visitante}</span>
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 28, fontWeight: 600, letterSpacing: "0.1em", color: C.suave, marginTop: 6 }}>{inf.sintesis.titular.toUpperCase()}</div>

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 26, marginTop: 22 }}>
        {/* Sin el partido en Wyscout (se baja los martes), el panel no se queda
            vacío: enseña cómo llegábamos los dos a la jornada. */}
        {!metricas.length && temporada.length ? (
          <Panel titulo="CÓMO LLEGÁBAMOS LOS DOS">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 21, fontWeight: 700, letterSpacing: "0.16em", marginBottom: 10 }}>
              <span style={{ color: C.oro }}>NOSOTROS · PUESTO EN LA LIGA</span>
              <span style={{ color: C.rival }}>{p.rival.toUpperCase()}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
              {temporada.map((m) => (
                <FilaDuelo key={m.key} m={m} equipos={inf.duelo?.equipos ?? 0} />
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 18, color: C.tenue }}>
              Wyscout aún no tiene este partido (se baja los martes o desde Ajustes): son las medias de la temporada hasta la jornada.
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
              <span style={{ fontSize: 26, color: C.tenue }}>
                Wyscout todavía no tiene este partido: se baja los martes (o desde Ajustes). El resto del informe ya vale.
              </span>
            )}
          </div>
        </Panel>
        )}

        {inf.sintesis.partido.length ? (
          <Panel titulo="LO QUE SE SALIÓ DE LO HABITUAL">
            <Lista items={inf.sintesis.partido} tamano={27} max={4} corte={130} />
          </Panel>
        ) : (
          <Panel titulo={inf.once.fuente === "marcado" ? "SU ONCE PREVISTO" : "SU ONCE"} acento={C.rival}>
            {inf.once.jugadores.length ? <Campo once={inf.once.jugadores} /> : <span style={{ fontSize: 24, color: C.tenue }}>Sin once.</span>}
          </Panel>
        )}
      </div>

      <Pie inf={inf} />
    </Marco>
  );
}

/** Forma de los dos y la clasificación, en una línea. */
function Pie({ inf }: { inf: InformePartido }) {
  const ctx = inf.contexto;

  return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, gap: 30 }}>
        <Forma titulo="NOSOTROS" lista={inf.duelo?.forma.nosotros ?? []} />
        <div style={{ fontSize: 22, fontWeight: 600, color: C.suave, textAlign: "center" }}>
          {ctx?.nuestroPuesto && ctx.puesto ? (
            <>
              Clasificación: <b style={{ color: C.oro }}>{ordinal(ctx.nuestroPuesto)} · {ctx.nuestrosPuntos} pts</b> <span style={{ color: C.tenue }}>contra</span>{" "}
              <b style={{ color: C.rival }}>{ordinal(ctx.puesto)} · {ctx.puntos} pts</b>
            </>
          ) : null}
        </div>
        <Forma titulo="ELLOS" lista={inf.duelo?.forma.rival ?? []} derecha />
      </div>
  );
}

function PostLecciones({ inf }: { inf: InformePartido }) {
  return (
    <Marco pagina={2} total={2} etiqueta="LO QUE NOS DEJA" inf={inf}>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 24 }}>
        <Panel titulo="EL PLAN, A REVISIÓN">
          <div style={{ fontSize: 20, color: C.tenue, marginBottom: 10 }}>Lo que nos propusimos. ¿Se cumplió?</div>
          <Lista items={inf.plan?.claves ?? []} numerada tamano={28} max={4} corte={110} />
          {inf.sintesis.vigilar.length > 0 && (
            <div style={{ marginTop: "auto", paddingTop: 18 }}>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "0.16em", color: C.rival, marginBottom: 10 }}>LOS QUE HABÍA QUE FRENAR</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {inf.sintesis.vigilar.slice(0, 2).map((j) => (
                  <TarjetaJugador key={j.clave} j={j} />
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel titulo="EN LA LIGA">
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "0.16em", color: C.bien, marginBottom: 8 }}>DONDE SOMOS MEJORES</div>
          <Lista items={inf.sintesis.ventajas} tamano={25} max={3} corte={90} />
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "0.16em", color: C.rival, margin: "26px 0 8px" }}>DONDE HAY QUE CRECER</div>
          <Lista
            items={(inf.duelo?.metricas ?? [])
              .filter((m) => m.mejorAlto !== null && m.nosotros && m.nosotros.puesto > (inf.duelo?.equipos ?? 20) * 0.6)
              .slice(0, 3)
              .map((m) => `${m.nombre}: ${cifra(m.nosotros!.valor, m.unidad)} (${ordinal(m.nosotros!.puesto)} de ${inf.duelo?.equipos ?? 20})`)}
            tamano={25}
            max={3}
          />
          {inf.contexto?.nuestroPuesto ? (
            <div style={{ marginTop: "auto", paddingTop: 18, display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontSize: 64, fontWeight: 700, color: C.oro, lineHeight: 1 }}>{ordinal(inf.contexto.nuestroPuesto)}</span>
              <span style={{ fontSize: 24, fontWeight: 600, color: C.suave }}>
                en la clasificación · {inf.contexto.nuestrosPuntos} pts
              </span>
            </div>
          ) : null}
        </Panel>

        <Panel titulo="LA SEMANA QUE LO PREPARÓ">
          <Semana inf={inf} />
        </Panel>
      </div>

      <Momento3 inf={inf} />
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
