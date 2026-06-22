"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useEffect, useMemo, useState, useRef } from "react";
import { Play } from "lucide-react";
import Papa from "papaparse";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=970113485&single=true&output=csv";

type Player = {
  posicion: string;
  jugador: string;
  ea: number;
  ie: number;
  ia: number;
  ee: number;
};

function num(v?: string) {
  return Number(String(v || "").replace(",", ".")) || 0;
}

function parseCSV(text: string): Player[] {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: false,
  });

  return parsed.data
    .map((r) => ({
      posicion: r[0]?.trim() || "",
      jugador: r[1]?.trim() || "",
      ea: num(r[2]),
      ie: num(r[3]),
      ia: num(r[4]),
      ee: num(r[5]),
    }))
    .filter((r) => r.jugador);
}

export default function EmotionPage() {
  const [isDesktop, setIsDesktop] = useState(false);
const videoRef = useRef<HTMLDivElement | null>(null);

useEffect(() => {
  const onResize = () => {
    setIsDesktop(window.innerWidth >= 1024);
  };

  onResize();
  window.addEventListener("resize", onResize);

  return () => window.removeEventListener("resize", onResize);
}, []);

const videoUrl =
  "https://drive.google.com/file/d/1pKrNKJwbiXjsKP4cJ8ROE-2E8-PlLyi8/view";

const scrollToVideo = () => {
  if (window.innerWidth < 1024) {
    window.open(videoUrl, "_blank");
    return;
  }

  videoRef.current?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
};
  const [rows, setRows] = useState<Player[]>([]);

  const [defense, setDefense] = useState<string[]>([]);
  const [leftSide, setLeftSide] = useState<string[]>([]);
  const [rightSide, setRightSide] = useState<string[]>([]);
  const [midfield, setMidfield] = useState<string[]>([]);
  const [strikers, setStrikers] = useState<string[]>([]);

  useEffect(() => {
    fetch(CSV_URL)
      .then((r) => r.text())
      .then((t) => {
        const parsed = parseCSV(t);

        setRows(parsed);

        const byName = (name: string) =>
          parsed.find((p) => p.jugador === name)?.jugador;

        setLeftSide(
  [
    byName("Diego Aguado"),
    byName("Alexis Ciria"),
  ].filter(Boolean) as string[]
);

setDefense(
  [
    byName("Diego Aguado"),
    byName("Mario Rivas"),
    byName("Joan Martínez"),
    byName("Fortea"),
  ].filter(Boolean) as string[]
);

setRightSide(
  [
    byName("Fortea"),
    byName("Yáñez"),
  ].filter(Boolean) as string[]
);

setMidfield(
  [
    byName("Cestero"),
    byName("Thiago"),
    byName("Pol Fortuny"),
  ].filter(Boolean) as string[]
);

setStrikers(
  [
    byName("Rachad"),
    byName("Pol Fortuny"),
  ].filter(Boolean) as string[]
);
      
      });
  }, []);

  const names = useMemo(() => rows.map((r) => r.jugador), [rows]);

  const getPlayer = (name: string) =>
    rows.find((r) => r.jugador === name);

  return (
    <main className="min-h-screen bg-[#030811] text-white">
      <div className="flex flex-col lg:flex-row">
        <Sidebar />

        <div className="flex-1 min-w-0">
          <Topbar />
          {/* Botón desktop */}
<button
  onClick={scrollToVideo}
  className="
    hidden lg:flex
    fixed right-6 top-1/2 -translate-y-1/2 z-50
    items-center gap-3
    rounded-full
    border border-[#C8A96B]/40
    bg-[#11161D]/90
    px-5 py-3
    text-sm font-medium
    text-white
    shadow-[0_12px_35px_rgba(0,0,0,0.35)]
    backdrop-blur-md
    hover:border-[#C8A96B]
    hover:bg-[#161D26]
    transition-all
  "
>
  <Play size={16} className="text-[#C8A96B]" />
  Ver explicación
</button>

{/* Botón móvil */}
<button
  onClick={scrollToVideo}
  className="
    lg:hidden
    fixed bottom-5 right-5 z-50
    rounded-full
    bg-[#C8A96B]
    text-black
    px-4 py-3
    text-sm font-semibold
    shadow-xl
    hover:opacity-90
    transition
  "
>
  Ver vídeo
</button>

          <section className="px-4 sm:px-8 pb-8 sm:pb-12 pt-6 sm:pt-10">

  {/* Header */}
  <div className="mb-5">
    <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
      RMCF CASTILLA INDIVIDUAL
    </p>

    <div className="mt-4 flex items-center gap-3 sm:gap-5">
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
        Rendimiento emocional
      </h1>

      <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
    </div>
  </div>
            <div
  className="rounded-[34px] p-4 sm:p-5 lg:p-6"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(5,14,24,.68), rgba(5,14,24,.68)), url('/emotional-field-bg.png')",
                backgroundSize: "100% 100%",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <div className="space-y-4">
                <RadarPanel
                  horizontal
                  title="Perfil izquierdo"
                  players={names}
                  selected={leftSide}
                  onChange={setLeftSide}
                  getPlayer={getPlayer}
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:-mt-6">
                  <RadarPanel
                    title="Defensa"
                    players={names}
                    selected={defense}
                    onChange={setDefense}
                    getPlayer={getPlayer}
                  />

                  <RadarPanel
                    title="Mediocampo"
                    players={names}
                    selected={midfield}
                    onChange={setMidfield}
                    getPlayer={getPlayer}
                  />

                  <RadarPanel
                    title="Puntas / Delanteros"
                    players={names}
                    selected={strikers}
                    onChange={setStrikers}
                    getPlayer={getPlayer}
                  />
                </div>

                <RadarPanel
                  horizontal
                  title="Perfil derecho"
                  players={names}
                  selected={rightSide}
                  onChange={setRightSide}
                  getPlayer={getPlayer}
                />
              </div> </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {[
    {
      title: "EXTERNO - AMPLIO",
      subtitle:
        "Observación / Lectura (qué ocurre)",
      detail: "Antes de intervenir",
    },
    {
      title: "INTERNO - AMPLIO",
      subtitle:
        "Análisis / Reflexión (qué hacer / resolución)",
      detail: "Juego parado",
    },
    {
      title: "EXTERNO - ESTRECHO",
      subtitle: "Ejecución de acción (1v1)",
      detail: "Participación",
    },
    {
      title: "INTERNO - ESTRECHO",
      subtitle: "Control emocional (qué siento)",
      detail: "Adversidad",
    },
  ].map((item) => (
    <div
      key={item.title}
      className="rounded-2xl border border-white/8 bg-[#08131F]/85 px-4 py-4"
    >
      <div className="text-[11px] uppercase tracking-[.15em] text-[#E1C77B]">
        {item.title}
      </div>

      <div className="mt-2 text-sm font-medium text-white leading-snug">
        {item.subtitle}
      </div>

      <div className="mt-2 text-xs text-white/55">
        {item.detail}
      </div>
    </div>
  ))}
</div>{/* Vídeo explicativo */}
<div ref={videoRef} className="mt-14 sm:mt-20">
  <div className="mb-6">
    <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
      Explicación visual
    </p>
  </div>

  {/* Desktop */}
  <div className="hidden lg:block rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-2 sm:p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm overflow-hidden">
    <iframe
      title="Video explicativo"
      src="https://drive.google.com/file/d/1pKrNKJwbiXjsKP4cJ8ROE-2E8-PlLyi8/preview"
      className="
        w-full
        border-0
        rounded-[18px] sm:rounded-[24px]
        bg-black
        h-[640px]
      "
      allow="autoplay"
      allowFullScreen
    />
  </div>

  {/* Móvil */}
  <div className="lg:hidden rounded-[24px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 text-center">
    <p className="text-white/80 text-sm mb-4">
      Ver explicación completa del análisis emocional
    </p>

    <button
      onClick={() => window.open(videoUrl, "_blank")}
      className="
        rounded-full
        bg-[#C8A96B]
        text-black
        px-5 py-3
        text-sm
        font-semibold
        shadow-xl
      "
    >
      ▶ Abrir vídeo
    </button>

</div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
type RadarSeriesItem = {
  name: string;
  color: string;
  values: Player;
};
function RadarPanel({
  title,
  players,
  selected,
  onChange,
  getPlayer,
  horizontal = false,
}: any) {
  const colors = [
    "#36DAFF",
    "#B66BFF",
    "#62E8FF",
    "#D17DFF",
  ];

  const fallbackSelected =
    selected.length > 0
      ? selected
      : players.slice(0, horizontal ? 2 : 4);

  const radarSeries: RadarSeriesItem[] = fallbackSelected
    .map((name: string, index: number) => ({
      name,
      color: colors[index % colors.length],
      values: getPlayer(name),
    }))
    .filter((s: any) => s.values);

  const chartData = [
    { key: "EA" },
    { key: "IE" },
    { key: "IA" },
    { key: "EE" },
  ].map((axis, i) => {
    const row: any = { key: axis.key };

    radarSeries.forEach((s: any) => {
      const vals = [
        s.values.ea,
        s.values.ie,
        s.values.ia,
        s.values.ee,
      ];

      row[s.name] = vals[i];
    });

    return row;

    
  });
 const synergyScore =
  radarSeries.length === 0
    ? 0
    : radarSeries.reduce(
        (acc, s) =>
          acc +
          (
            s.values.ea +
            s.values.ie +
            s.values.ia +
            s.values.ee
          ) /
            4,
        0
      ) / radarSeries.length;

const radarTone =
  synergyScore >= 8.5
    ? "#3BEA9A"
    : synergyScore >= 7.5
    ? "#36DAFF"
    : synergyScore >= 6.5
    ? "#8D7CFF"
    : "#FFB84D";

const synergyLabel =
  synergyScore >= 8.5
    ? "ÉLITE"
    : synergyScore >= 7.5
    ? "ALTA"
    : synergyScore >= 6.5
    ? "MEDIA"
    : "MEJORABLE";

  return (
    <div
  className="rounded-[24px] p-3 sm:p-4 min-h-[255px] border"
  style={{
    borderColor: `${radarTone}55`,
    background: `radial-gradient(circle at center, ${radarTone}15 0%, transparent 75%)`,
    boxShadow: `0 0 30px ${radarTone}20`,
  }}
>
      <div className="mb-1 flex items-center justify-between">
  <div className="text-[12px] font-semibold uppercase tracking-[.15em] text-[#E4C977]">
    {title}
  </div>

  <div
    className="rounded-full px-3 py-1 text-[10px] font-bold"
    style={{
      background: radarTone,
      color: "#031018",
    }}
  >
    {synergyLabel}
  </div>
</div>

<div className="mb-2 lg:-mb-2 flex items-center flex-wrap gap-2">
  <span className="text-[11px] text-white/65 shrink-0">
    Sinergia: {synergyScore.toFixed(1)} / 10
  </span>

  {fallbackSelected.map((player: string, i: number) => (
    <span
      key={player}
      className="rounded-full px-2 py-0.5 text-[9px] font-medium"
      style={{
        background: colors[i % colors.length] + "25",
        color: colors[i % colors.length],
        border: `1px solid ${colors[i % colors.length]}40`,
      }}
    >
      {player}
    </span>
  ))}
</div>

      <div className="flex flex-col gap-4 lg:flex-row h-full items-center">
        <select
          multiple
          value={selected}
          onChange={(e) =>
            onChange(
              Array.from(e.target.selectedOptions).map(
                (o) => o.value
              )
            )
          }
          className="w-full lg:w-[130px] h-[130px] lg:h-[175px]
          rounded-2xl
          border border-white/10
          bg-white/[0.04]
          backdrop-blur-xl
          px-3 py-2
          text-[11px]
          text-white
          shadow-[inset_0_0_14px_rgba(255,255,255,.03)]
          scrollbar-thin
          scrollbar-thumb-white/20
          scrollbar-track-transparent"
        >
          {players.map((name: string) => (
            <option
              key={name}
              value={name}
              className="bg-[#09111a] text-white rounded"
            >
              {name}
            </option>
          ))}
        </select>

        <div className="w-full lg:flex-1 h-[210px] sm:h-[220px] flex items-start justify-center overflow-visible">
  <RadarChart
  width={
    typeof window !== "undefined" &&
    window.innerWidth < 1024
      ? 260
      : horizontal
      ? 520
      : 310
  }
  height={
  typeof window !== "undefined" &&
  window.innerWidth < 1024
    ? 220
    : 250
}
    data={chartData}
    outerRadius="86%"
    margin={{
  top: -10,
  right: 12,
  bottom: 8,
  left: 12,
}}
  >
            <PolarGrid stroke={radarTone + "40"} />

            <PolarAngleAxis
  dataKey="key"
  tick={{
    fill: "#ffffff",
    fontSize: 11,
  }}
  dy={2}
/>

            <PolarRadiusAxis
              domain={[0, 10]}
              tick={false}
              axisLine={false}
            />

            {radarSeries.map((s: any) => (
              <Radar
  key={s.name}
  dataKey={s.name}
  stroke={s.color}
  fill={radarTone}
  fillOpacity={0.12}
  strokeWidth={2.8}
/>
            ))}
          </RadarChart>
        </div>
      </div>
    </div>
  );
}