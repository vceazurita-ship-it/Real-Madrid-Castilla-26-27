"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSh09fkRENqEbw7HEdvstBrx7tTqMUttHj4p61dnFDly1cyaSXEed24uSqM3KvQ_ThkNUrp3gFTRMef/pub?gid=970113485&single=true&output=csv";

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

        setDefense(
          [
            byName("Melvin"),
            byName("Sotres"),
            byName("Lezcano"),
            byName("Ariel"),
          ].filter(Boolean) as string[]
        );

        setLeftSide(
          [byName("Sotres"), byName("Leiva")].filter(Boolean) as string[]
        );

        setRightSide(
          [byName("Melvin"), byName("Mesonero")].filter(Boolean) as string[]
        );

        setMidfield(
          [byName("Lacosta"), byName("Manex"), byName("Rober")].filter(
            Boolean
          ) as string[]
        );

        setStrikers(
          [byName("Rober"), byName("Jacobo")].filter(Boolean) as string[]
        );
      });
  }, []);

  const names = useMemo(() => rows.map((r) => r.jugador), [rows]);

  const getPlayer = (name: string) =>
    rows.find((r) => r.jugador === name);

  return (
    <main className="min-h-screen bg-[#030811] text-white">
      <div className="flex">
        <Sidebar />

        <div className="flex-1">
          <Topbar />

          <section className="px-8 py-8">
            <div
              className="rounded-[34px] p-6"
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

                <div className="grid grid-cols-3 gap-4">
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
              </div>

              <div className="mt-5 grid grid-cols-4 gap-4">
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
</div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

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

  const radarSeries = fallbackSelected
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

  return (
    <div className="rounded-[24px] border border-white/10 bg-transparent p-4 h-[255px]">
      <div className="mb-2 text-[12px] font-semibold uppercase tracking-[.15em] text-[#E4C977]">
        {title}
      </div>

      <div className="flex gap-4 h-full items-center">
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
          className="w-[130px] h-[175px]
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

        <div className="flex-1 h-[200px] flex items-center justify-center">
          <RadarChart
            width={horizontal ? 520 : 310}
            height={210}
            data={chartData}
            outerRadius="92%"
          >
            <PolarGrid stroke="#66d9ff28" />

            <PolarAngleAxis
              dataKey="key"
              tick={{
                fill: "#ffffff",
                fontSize: 11,
              }}
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
                fill={s.color}
                fillOpacity={0.16}
                strokeWidth={2.8}
              />
            ))}
          </RadarChart>
        </div>
      </div>
    </div>
  );
}