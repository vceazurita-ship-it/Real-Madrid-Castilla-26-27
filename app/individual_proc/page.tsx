"use client";

import { useEffect, useMemo, useState } from "react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { usePlayers } from "@/hooks/usePlayers";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

type TrackingRecord = {
  ID_REGISTRO: string;
  ID_JUGADOR: string;
  FECHA: string;
  OBJETIVO_OFENSIVO: string;
  OBJETIVO_DEFENSIVO: string;
  OBJETIVO_MENTAL: string;
  FEEDBACK: string;
  QUIEN: string;
  MODALIDAD: string;
  MOMENTO: string;
  ESTRATEGIA: string;
};

const COLORS = [
  "#C8A96B",
  "#D6B67A",
  "#A58A54",
  "#8E7546",
];
export default function DashboardSeguimiento() {

const { players } = usePlayers();

const [tracking,setTracking] =
useState<TrackingRecord[]>([]);

const [selectedPlayer,setSelectedPlayer] =
useState("");

useEffect(() => {

fetch(
`${APPS_SCRIPT_URL}?action=seguimiento`
)
.then(r=>r.json())
.then(data=>setTracking(data))
.catch(console.error);

},[]);
const playerMap = useMemo(()=>{

return Object.fromEntries(

players.map(p=>[

p.id,
p

])

);

},[players]);
const totalSessions = tracking.length;

const totalPlayers =
new Set(
tracking.map(s=>s.ID_JUGADOR)
).size;

const totalWeeks =
new Set(

tracking.map(s=>{

const d=new Date(s.FECHA);

const first=new Date(
d.getFullYear(),
0,
1
);

return Math.ceil(

((d.getTime()-first.getTime())/
86400000+
first.getDay()+1)/7

);

})

).size;

const averageWeek =
totalWeeks
? (totalSessions/totalWeeks).toFixed(1)
:0;
const coachData =
useMemo(()=>{

const map:{}|any={};

tracking.forEach(s=>{

map[s.QUIEN]=
(map[s.QUIEN]??0)+1;

});

return Object.entries(map)

.map(([name,value])=>({

name,
value

}))

.sort((a:any,b:any)=>

b.value-a.value

);

},[tracking]);

const topCoach=
coachData[0]?.name ?? "-";
const playerChart=
useMemo(()=>{

const map:{}|any={};

tracking.forEach(s=>{

const jugador=

playerMap[s.ID_JUGADOR];

const nombre=

jugador?.nombre ??
s.ID_JUGADOR;

map[nombre]=
(map[nombre]??0)+1;

});

return Object.entries(map)

.map(([name,value])=>({

name,
value

}))

.sort((a:any,b:any)=>

b.value-a.value

);

},[
tracking,
playerMap
]);
const strategyData=
useMemo(()=>{

const map:{}|any={};

tracking.forEach(s=>{

map[s.ESTRATEGIA]=
(map[s.ESTRATEGIA]??0)+1;

});

return Object.entries(map)

.map(([name,value])=>({

name,
value

}));

},[tracking]);
const weeklyData=
useMemo(()=>{

const map:{}|any={};

tracking.forEach(s=>{

const d=new Date(s.FECHA);

const first=new Date(
d.getFullYear(),
0,
1
);

const week=Math.ceil(

((d.getTime()-first.getTime())/
86400000+
first.getDay()+1)/7

);

map[week]=
(map[week]??0)+1;

});

return Object.keys(map)

.sort((a,b)=>

Number(a)-Number(b)

)

.map(week=>({

week,
value:map[week]

}));

},[tracking]);
return (
  <main className="min-h-screen bg-[#0B0F14] text-white">
    <div className="flex">

      <Sidebar />

      <section className="flex-1">

        <Topbar />

        <div className="px-8 py-8">

          <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
            RMCF CASTILLA · INDIVIDUAL
          </p>

          <div className="mt-4 flex items-center gap-5">

            <h1 className="text-4xl font-semibold">
              Dashboard Seguimiento Individual
            </h1>

            <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />

          </div>

          {/* KPIs */}

          <div className="grid grid-cols-4 gap-5 mt-10">

            <div className="rounded-3xl border border-white/10 bg-[#121922] p-6">

              <p className="text-white/50 text-sm">
                Seguimientos
              </p>

              <h2 className="mt-3 text-5xl font-bold text-[#C8A96B]">
                {totalSessions}
              </h2>

            </div>

            <div className="rounded-3xl border border-white/10 bg-[#121922] p-6">

              <p className="text-white/50 text-sm">
                Jugadores
              </p>

              <h2 className="mt-3 text-5xl font-bold">
                {totalPlayers}
              </h2>

            </div>

            <div className="rounded-3xl border border-white/10 bg-[#121922] p-6">

              <p className="text-white/50 text-sm">
                Media semanal
              </p>

              <h2 className="mt-3 text-5xl font-bold">
                {averageWeek}
              </h2>

            </div>

            <div className="rounded-3xl border border-white/10 bg-[#121922] p-6">

              <p className="text-white/50 text-sm">
                Coach más activo
              </p>

              <h2 className="mt-3 text-2xl font-bold text-[#C8A96B]">
                {topCoach}
              </h2>

            </div>

          </div>

          {/* FILA 1 */}

          <div className="grid grid-cols-2 gap-6 mt-10">

            {/* BARRAS */}

            <div className="rounded-3xl border border-white/10 bg-[#121922] p-6">

              <h3 className="mb-6 text-lg font-semibold">
                Seguimientos por jugador
              </h3>

              <ResponsiveContainer width="100%" height={350}>

                <BarChart data={playerChart}>

                  <CartesianGrid stroke="#333" />

                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#999", fontSize: 11 }}
                  />

                  <YAxis
                    tick={{ fill: "#999" }}
                  />

                  <Tooltip />

                  <Bar
                    dataKey="value"
                    fill="#C8A96B"
                    radius={[6,6,0,0]}
                  />

                </BarChart>

              </ResponsiveContainer>

            </div>

            {/* PIE */}

            <div className="rounded-3xl border border-white/10 bg-[#121922] p-6">

              <h3 className="mb-6 text-lg font-semibold">
                Estrategias utilizadas
              </h3>

              <ResponsiveContainer width="100%" height={350}>

                <PieChart>

                  <Pie

                    data={strategyData}

                    dataKey="value"

                    nameKey="name"

                    outerRadius={120}

                    label

                  >

                    {strategyData.map((_,i)=>(

                      <Cell
                        key={i}
                        fill={
                          COLORS[
                            i % COLORS.length
                          ]
                        }
                      />

                    ))}

                  </Pie>

                  <Tooltip />

                </PieChart>

              </ResponsiveContainer>

            </div>

          </div>

          {/* FILA 2 */}

          <div className="grid grid-cols-2 gap-6 mt-6">

            {/* EVOLUCIÓN */}

            <div className="rounded-3xl border border-white/10 bg-[#121922] p-6">

              <h3 className="mb-6 text-lg font-semibold">
                Evolución semanal
              </h3>

              <ResponsiveContainer width="100%" height={350}>

                <LineChart data={weeklyData}>

                  <CartesianGrid stroke="#333"/>

                  <XAxis
                    dataKey="week"
                    tick={{fill:"#999"}}
                  />

                  <YAxis
                    tick={{fill:"#999"}}
                  />

                  <Tooltip/>

                  <Line

                    type="monotone"

                    dataKey="value"

                    stroke="#C8A96B"

                    strokeWidth={3}

                  />

                </LineChart>

              </ResponsiveContainer>

            </div>

            {/* RADAR */}

            <div className="rounded-3xl border border-white/10 bg-[#121922] p-6">

              <h3 className="mb-6 text-lg font-semibold">
                Distribución estrategias
              </h3>

              <ResponsiveContainer width="100%" height={350}>

                <RadarChart data={strategyData}>

                  <PolarGrid/>

                  <PolarAngleAxis
                    dataKey="name"
                  />

                  <PolarRadiusAxis/>

                  <Radar

                    dataKey="value"

                    stroke="#C8A96B"

                    fill="#C8A96B"

                    fillOpacity={0.45}

                  />

                </RadarChart>

              </ResponsiveContainer>

            </div>

          </div>

        </div>

      </section>

    </div>

  </main>
);
}