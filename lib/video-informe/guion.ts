/*
|--------------------------------------------------------------------------
| EL GUION DEL VÍDEO RESUMEN
|--------------------------------------------------------------------------
|
| El vídeo cuenta lo mismo que el PDF del informe, en menos de un minuto: una
| portada, las cifras, las claves, un corte de vídeo del rival si lo hay y un
| cierre. Aquí sólo se decide QUÉ se cuenta y en qué orden; `monta.ts` lo
| pinta y lo codifica, y `/api/informe/video-guion` (Gemini, sin coste) pule
| la locución. Si la IA no contesta, el guion de aquí ya se puede locutar tal
| cual: nada depende de ella.
|
| Dos adaptadores, uno por informe: el del partido (previa/post, desde
| Microciclos) y el de ABP (la semana de balón parado).
*/

import type { InformePartido, PinceladaAbp } from "@/lib/informe-partido/modelo";
import type { InformeMicro } from "@/lib/abp/informe-micro";

export type Cifra = { rotulo: string; valor: string; pie?: string };

export type Escena =
  | { id: string; tipo: "portada"; titulo: string; subtitulo: string; sello: string; locucion: string }
  | { id: string; tipo: "cifras"; titulo: string; cifras: Cifra[]; locucion: string }
  | { id: string; tipo: "claves"; titulo: string; lineas: string[]; locucion: string }
  | { id: string; tipo: "barras"; titulo: string; barras: { rotulo: string; valor: number; texto: string }[]; locucion: string }
  | { id: string; tipo: "clip"; titulo: string; url: string; segundos: number; locucion: string }
  | { id: string; tipo: "imagen"; titulo: string; src: string; pie: string; locucion: string }
  | { id: string; tipo: "cierre"; titulo: string; lineas: string[]; locucion: string };

export type GuionVideo = {
  /** Para el nombre del archivo y el rótulo de la esquina. */
  titulo: string;
  escenas: Escena[];
};

/** Tope duro: el correo no debe llevar más de un minuto de vídeo. */
export const SEGUNDOS_MAXIMOS = 58;

const corta = (t: string, n = 90) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

const limpia = (t: string) => t.replace(/\s+/g, " ").trim();

/** Un vídeo del bucket se puede leer en el navegador; un enlace de YouTube, no. */
const esClipLegible = (url: string) => /^https?:\/\/.+\.(mp4|m4v|mov)(\?|$)/i.test(url) || /supabase\.co\/storage/i.test(url);

/* ------------------------------------------------------------------ */
/*  EL INFORME DEL PARTIDO                                             */
/* ------------------------------------------------------------------ */

export function guionDePartido(informe: InformePartido): GuionVideo {
  const { partido, sintesis, pronostico, momento } = informe;
  const previa = momento === "previa";
  const lado = partido.lado === "casa" ? "en casa" : partido.lado === "fuera" ? "fuera" : "";
  const marcador = partido.gf !== null && partido.gc !== null ? `${partido.gf}-${partido.gc}` : "";
  const escenas: Escena[] = [];

  escenas.push({
    id: "portada",
    tipo: "portada",
    titulo: `Castilla – ${partido.rival}`,
    subtitulo: [partido.jornada ? `Jornada ${partido.jornada}` : "", partido.fechaTexto, lado].filter(Boolean).join(" · "),
    sello: previa ? "PREVIA" : `POST${marcador ? ` · ${marcador}` : ""}`,
    locucion: previa
      ? `${partido.rival}, ${lado || "próximo partido"}. ${limpia(sintesis.titular)}`
      : `${partido.rival}${marcador ? `, ${marcador}` : ""}. ${limpia(sintesis.titular)}`,
  });

  if (pronostico) {
    const p = previa ? pronostico : pronostico;
    escenas.push({
      id: "pronostico",
      tipo: "barras",
      titulo: previa ? "Lo que dice el dato" : "Lo que decía el dato",
      barras: [
        { rotulo: "Victoria", valor: p.victoria, texto: `${Math.round(p.victoria * 100)} %` },
        { rotulo: "Empate", valor: p.empate, texto: `${Math.round(p.empate * 100)} %` },
        { rotulo: "Derrota", valor: p.derrota, texto: `${Math.round(p.derrota * 100)} %` },
        ...(previa ? [{ rotulo: "Con el plan", valor: p.conPlan.victoria, texto: `${Math.round(p.conPlan.victoria * 100)} % de victoria` }] : []),
      ],
      locucion: previa
        ? `El modelo nos da un ${Math.round(p.victoria * 100)} por ciento de victoria; con el plan, un ${Math.round(p.conPlan.victoria * 100)}. ${limpia(p.idea)}`
        : limpia(sintesis.veredicto || p.lectura),
    });
  }

  const claves = (previa ? sintesis.claves : sintesis.partido.length ? sintesis.partido : sintesis.claves).slice(0, 4).map((c) => corta(limpia(c)));

  if (claves.length) {
    escenas.push({
      id: "claves",
      tipo: "claves",
      titulo: previa ? "Las claves" : "Lo que dijo el partido",
      lineas: claves,
      locucion: claves.join(". "),
    });
  }

  const ventajas = sintesis.ventajas.slice(0, 2).map((v) => corta(limpia(v), 70));
  const amenazas = sintesis.amenazas.slice(0, 2).map((v) => corta(limpia(v), 70));

  if (ventajas.length || amenazas.length) {
    escenas.push({
      id: "duelo",
      tipo: "cifras",
      titulo: "Dónde ganamos y dónde ganan ellos",
      cifras: [...ventajas.map((v) => ({ rotulo: "A favor", valor: v })), ...amenazas.map((v) => ({ rotulo: "Vigilar", valor: v }))],
      locucion: `A favor: ${ventajas.join("; ")}. A vigilar: ${amenazas.join("; ")}.`,
    });
  }

  const vigilar = (previa ? sintesis.vigilar.slice(0, 3).map((j) => j.nombre) : sintesis.frenados.slice(0, 3).map((f) => `${f.jugador.nombre}: ${corta(limpia(f.texto), 50)}`)).filter(Boolean);

  const clip = informe.recursos.videos.find((v) => esClipLegible(v.url));

  if (clip) {
    escenas.push({
      id: "clip",
      tipo: "clip",
      titulo: vigilar.length ? `A vigilar: ${vigilar.join(" · ")}` : clip.nombre,
      url: clip.url,
      segundos: 7,
      locucion: vigilar.length ? `${previa ? "Sus hombres a vigilar" : "Los que había que frenar"}: ${vigilar.join(", ")}.` : limpia(clip.nombre),
    });
  } else if (vigilar.length) {
    escenas.push({
      id: "vigilar",
      tipo: "claves",
      titulo: previa ? "A vigilar" : "¿Los frenamos?",
      lineas: vigilar,
      locucion: `${previa ? "Sus hombres a vigilar" : "Los que había que frenar"}: ${vigilar.join(", ")}.`,
    });
  }

  const abp = informe.abp?.pincelada ?? null;

  if (abp && (abp.claves.length || abp.cifras.length)) {
    escenas.push({
      id: "abp",
      tipo: "cifras",
      titulo: "Balón parado",
      cifras: abp.cifras.slice(0, 4),
      locucion: `Balón parado: ${limpia(abp.titular)}`,
    });
  }

  const cierre = previa
    ? sintesis.claves.slice(0, 1).map((c) => corta(limpia(c), 80))
    : sintesis.relato.slice(0, 2).map((c) => corta(limpia(c), 80));

  escenas.push({
    id: "cierre",
    tipo: "cierre",
    titulo: previa ? "El plan, en una frase" : "Lo que nos deja",
    lineas: cierre.length ? cierre : [limpia(sintesis.titular)],
    locucion: previa ? `En una frase: ${cierre[0] ?? limpia(sintesis.titular)}` : `Lo que nos deja: ${(cierre[0] ?? limpia(sintesis.titular))}`,
  });

  return { titulo: `${partido.rival} · ${previa ? "previa" : "post"}`, escenas };
}

/* ------------------------------------------------------------------ */
/*  EL INFORME DE ABP DE LA SEMANA                                     */
/* ------------------------------------------------------------------ */

export function guionDeAbp(informe: InformeMicro, pincelada: PinceladaAbp): GuionVideo {
  const escenas: Escena[] = [];

  escenas.push({
    id: "portada",
    tipo: "portada",
    titulo: informe.titulo,
    subtitulo: [informe.subtitulo, informe.rango].filter(Boolean).join(" · "),
    sello: `BALÓN PARADO · ${informe.modoRotulo.toUpperCase()}`,
    locucion: `Balón parado, ${informe.modoRotulo}. ${limpia(pincelada.titular)}`,
  });

  const resumen = informe.resumen.slice(0, 4);

  if (resumen.length) {
    escenas.push({
      id: "cifras",
      tipo: "cifras",
      titulo: "La semana en cifras",
      cifras: resumen,
      locucion: resumen.map((c) => `${c.rotulo}: ${c.valor}`).join(". "),
    });
  }

  const claves = pincelada.claves.slice(0, 4).map((c) => corta(limpia(c)));

  if (claves.length) {
    escenas.push({ id: "claves", tipo: "claves", titulo: "Lo que hay que mirar", lineas: claves, locucion: claves.join(". ") });
  }

  /* Los dos primeros gráficos del área «mirar» son los que contestan la semana. */
  const graficos = informe.graficos.filter((g) => g.imagen.startsWith("data:image/")).slice(0, 2);

  for (const [i, g] of graficos.entries()) {
    escenas.push({ id: `grafico-${i}`, tipo: "imagen", titulo: g.titulo, src: g.imagen, pie: corta(limpia(g.leyenda), 110), locucion: corta(limpia(g.leyenda), 160) });
  }

  const rival = pincelada.rival.slice(0, 3).map((c) => corta(limpia(c)));

  if (rival.length) {
    escenas.push({ id: "rival", tipo: "claves", titulo: "El rival a balón parado", lineas: rival, locucion: rival.join(". ") });
  }

  escenas.push({
    id: "cierre",
    tipo: "cierre",
    titulo: informe.modo === "post" ? "Lo que nos deja" : "Para esta semana",
    lineas: [corta(limpia(pincelada.titular), 90)],
    locucion: limpia(pincelada.titular),
  });

  return { titulo: `ABP · ${informe.titulo}`, escenas };
}
