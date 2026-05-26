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
        [
          byName("Sotres"),
          byName("Leiva"),
        ].filter(Boolean) as string[]
      );

      setRightSide(
        [
          byName("Melvin"),
          byName("Mesonero"),
        ].filter(Boolean) as string[]
      );

      setMidfield(
        [
          byName("Lacosta"),
          byName("Manex"),
          byName("Rober"),
        ].filter(Boolean) as string[]
      );

      setStrikers(
        [
          byName("Rober"),
          byName("Jacobo"),
        ].filter(Boolean) as string[]
      );
    });
}, []);

  const names = useMemo(
    () => rows.map((r) => r.jugador),
    [rows]
  );

  const getPlayer = (name: string) =>
    rows.find((r) => r.jugador === name);

  return (
    <main className="min-h-screen bg-[#050B12] text-white">
      <div className="flex">
        <Sidebar />

        <div className="flex-1">
          <Topbar />

          <section className="px-8 py-8">
            <div className="mb-6">
              <p className="text-xs tracking-[0.35em] uppercase text-[#C8A96B]">
                Emotional Intelligence
              </p>

              <h1 className="mt-2 text-3xl font-semibold">
                Emotional Dynamics Ecosystem
              </h1>

              <div className="mt-6 grid grid-cols-2 gap-5">
 
</div>
            </div>

            <div
  className="relative rounded-[28px] border border-white/10 p-8 min-h-[82vh] overflow-hidden bg-[#071018] bg-cover bg-center bg-no-repeat"
  style={{
    backgroundImage:
      "linear-gradient(rgba(7,16,24,.82), rgba(7,16,24,.82)), url('/emotional-field-bg.png')",
    backgroundPosition: "center center",
  }}
>
              <div className="flex gap-6 items-center h-full">
                <RadarPanel
                  compact
                  title="Defensa"
                  width={350}
                  players={names}
                  selected={defense}
                  onChange={setDefense}
                  getPlayer={getPlayer}
                />

                <div className="flex flex-col gap-6">
                  <RadarPanel
                    horizontal
                    title="Perfil izquierdo"
                    width={350}
                    players={names}
                    selected={leftSide}
                    onChange={setLeftSide}
                    getPlayer={getPlayer}
                  />

                  <RadarPanel
                    horizontal
                    title="Perfil derecho"
                    width={350}
                    players={names}
                    selected={rightSide}
                    onChange={setRightSide}
                    getPlayer={getPlayer}
                  />
                </div>

                <RadarPanel
                  title="Mediocampo"
                  width={350}
                  players={names}
                  selected={midfield}
                  onChange={setMidfield}
                  getPlayer={getPlayer}
                />

                <RadarPanel
                  title="Puntas / Delanteros"
                  width={350}
                  players={names}
                  selected={strikers}
                  onChange={setStrikers}
                  getPlayer={getPlayer}
                />
                
              </div>
              
            </div>
            <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4">
  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[11px] leading-relaxed">
      <div>
        <div className="font-semibold uppercase tracking-[0.16em] text-[#E6C37A]">
          Externo · Amplio
        </div>
        <div className="mt-1 text-white/60">
          Observación / Lectura · Antes de intervenir
        </div>
      </div>

      <div>
        <div className="font-semibold uppercase tracking-[0.16em] text-[#E6C37A]">
          Externo · Estrecho
        </div>
        <div className="mt-1 text-white/60">
          Ejecución de acción (1v1) · Participación
        </div>
      </div>

      <div>
        <div className="font-semibold uppercase tracking-[0.16em] text-[#E6C37A]">
          Interno · Amplio
        </div>
        <div className="mt-1 text-white/60">
          Análisis / Reflexión · Juego parado
        </div>
      </div>

      <div>
        <div className="font-semibold uppercase tracking-[0.16em] text-[#E6C37A]">
          Interno · Estrecho
        </div>
        <div className="mt-1 text-white/60">
          Control emocional · Adversidad
        </div>
      </div>
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
  width,
  compact = false,
  horizontal = false,
}: any) {
  const colors = [
    "#C8A96B",
    "#38BDF8",
    "#A855F7",
    "#22C55E",
    "#F43F5E",
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
    { key: "E.A." },
    { key: "I.E." },
    { key: "I.A." },
    { key: "E.E." },
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

  const chartSize = 200;

  return (
    <div
      className="rounded-3xl border border-white/10 bg-[#0B141D] p-4"
      style={{ width }}
    >
      <div className="mb-3 flex justify-between">
        <h3 className="text-sm font-semibold uppercase text-[#E6C37A]">
          {title}
        </h3>

        <span className="text-[11px] text-white/45">
          {selected.length}
        </span>
      </div>

      <div className={horizontal ? "flex gap-4 items-start" : ""}>
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
          className={
            horizontal
              ? "w-[130px] h-[210px] rounded-xl border border-white/10 bg-[#101923] px-2 py-2 text-xs text-white"
              : "w-full h-[145px] rounded-xl border border-white/10 bg-[#101923] px-2 py-2 text-xs text-white mb-4"
          }
        >
          {players.map((name: string) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <div
          className={
            horizontal
              ? "flex-1 flex justify-center"
              : "flex justify-center"
          }
        >
          <RadarChart
            width={chartSize}
            height={chartSize}
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius="70%"
          >
            <PolarGrid stroke="#ffffff15" />

            <PolarAngleAxis
              dataKey="key"
              tick={{
                fill: "#ffffffcc",
                fontSize: 10,
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
                fillOpacity={0.14}
                strokeWidth={2.5}
              />
            ))}
          </RadarChart>
        </div>
      </div>
    </div>
  );
}