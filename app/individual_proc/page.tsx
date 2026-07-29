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
  Legend,
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
const MONTHS = [
"",
"Enero",
"Febrero",
"Marzo",
"Abril",
"Mayo",
"Junio",
"Julio",
"Agosto",
"Septiembre",
"Octubre",
"Noviembre",
"Diciembre"
];

const COLORS = [
  "#C8A96B", // Oro
  "#6E7F99", // Gris azulado
  "#4C7A67", // Verde petróleo
  "#8B5E5E", // Burdeos apagado
];
export default function DashboardSeguimiento() {

const { players } = usePlayers();

const [tracking,setTracking] =
useState<TrackingRecord[]>([]);

const [filters, setFilters] = useState({
  player: "",
  position: "",
  coach: "",
  strategy: "",
  month: "",
  week: "",
});
const emptyFilters = {
    player:"",
    position:"",
    coach:"",
    strategy:"",
    month:"",
    week:""
};
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

const filteredTracking = useMemo(() => {
  return tracking.filter((s) => {
    const jugador = playerMap[s.ID_JUGADOR];

    const month = new Date(s.FECHA).getMonth() + 1;

    const first = new Date(
      new Date(s.FECHA).getFullYear(),
      0,
      1
    );

    const week = Math.ceil(
      (
        (
          new Date(s.FECHA).getTime() -
          first.getTime()
        ) /
        86400000 +
        first.getDay() +
        1
      ) / 7
    );

    if (
      filters.player &&
      s.ID_JUGADOR !== filters.player
    )
      return false;

    if (
      filters.strategy &&
      s.ESTRATEGIA !== filters.strategy
    )
      return false;

    if (
      filters.coach &&
      s.QUIEN !== filters.coach
    )
      return false;

    if (
      filters.month &&
      month !== Number(filters.month)
    )
      return false;

    if (
      filters.week &&
      week !== Number(filters.week)
    )
      return false;

    if (
      filters.position &&
      jugador?.posicion !== filters.position
    )
      return false;

    return true;
  });
}, [tracking, playerMap, filters]);

const totalSessions = filteredTracking.length;

const totalPlayers =
new Set(
filteredTracking.map(s=>s.ID_JUGADOR)
).size;

const totalWeeks =
new Set(

filteredTracking.map(s=>{

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

const playerChart=
useMemo(()=>{

const map: Record<string, number> = {};

filteredTracking.forEach(s=>{

const jugador=

playerMap[s.ID_JUGADOR];

const nombre=

jugador?.nombre ??
s.ID_JUGADOR;

map[nombre]=
(map[nombre]??0)+1;

});

return Object.entries(map)
  .map(([name, value]) => ({
    name,
    value,
    percentage:
totalSessions
?value*100/totalSessions
:0
  }))
  .sort((a, b) => b.value - a.value);

},[
filteredTracking,
playerMap
]);

const mostTrackedPlayer =
  playerChart.length > 0
    ? playerChart[0]
    : { name: "-", value: 0 };

const leastTrackedPlayer =
  playerChart.length > 0
    ? playerChart[playerChart.length - 1]
    : { name: "-", value: 0 };
const strategyData=
useMemo(()=>{

const map: Record<string, number> = {};

filteredTracking.forEach(s=>{

map[s.ESTRATEGIA]=
(map[s.ESTRATEGIA]??0)+1;

});

return Object.entries(map)
  .map(([name, value]) => ({
    name,
    value,
    percentage:
totalSessions
?value*100/totalSessions
:0
  }));

},[filteredTracking]);
const weeklyData=
useMemo(()=>{

const map: Record<string, number> = {};

filteredTracking.forEach(s=>{

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
  .sort((a, b) => Number(a) - Number(b))
  .map((week) => ({
    week,
    value: map[Number(week)],
    percentage:
      totalSessions
        ? map[Number(week)] * 100 / totalSessions
        : 0
  }));

},[filteredTracking]);

const filterOptions = useMemo(() => {

    const positions = [...new Set(
        players
            .map(p => p.posicion)
            .filter(Boolean)
    )].sort();

    const coaches = [...new Set(
        tracking
            .map(t => t.QUIEN)
            .filter(Boolean)
    )].sort();

    const strategies = [...new Set(
        tracking
            .map(t => t.ESTRATEGIA)
            .filter(Boolean)
    )].sort();

    const months = [...new Set(
        tracking.map(t =>
            new Date(t.FECHA).getMonth() + 1
        )
    )].sort((a,b)=>a-b);

    const weeks = [...new Set(
        tracking.map(t=>{

            const d = new Date(t.FECHA);

            const first = new Date(
                d.getFullYear(),
                0,
                1
            );

            return Math.ceil(
                (
                    (d.getTime()-first.getTime())/86400000 +
                    first.getDay()+1
                )/7
            );

        })
    )].sort((a,b)=>a-b);

    return {
        positions,
        coaches,
        strategies,
        months,
        weeks
    };

},[players,tracking]);
const updateFilter = (
    key:keyof typeof filters,
    value:string
)=>{

    setFilters(prev=>({

        ...prev,

        [key]:value

    }));

}
return (
  <main className="min-h-screen bg-[#0B0F14] text-white">
    <div className="flex">

      <Sidebar />

      <section className="flex-1">

        <Topbar />

        <div className="px-4 md:px-8 py-6 md:py-8">

          <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
            RMCF CASTILLA · INDIVIDUAL
          </p>

          <div className="mt-3 flex flex-col md:flex-row md:items-center gap-4">

            <h1 className="text-2xl md:text-4xl font-semibold">
              Dashboard Seguimiento Individual
            </h1>
<div className="mt-8 grid grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 gap-3">

<select
value={filters.player}
onChange={(e)=>
setFilters({
...filters,
player:e.target.value
})
}
className="rounded-xl bg-[#121922] border border-white/10 p-3"
>

<option value="">Jugador</option>

{players.map(p=>(

<option
key={p.id}
value={p.id}
>

{p.nombre}

</option>

))}

</select>
<select
    value={filters.position}
    onChange={(e)=>
        setFilters({
            ...filters,
            position:e.target.value
        })
    }
    className="rounded-xl bg-[#121922] border border-white/10 p-3"
>

<option value="">Posición</option>

{[
...new Set(
players.map(p=>p.posicion)
)
].map(pos=>(

<option
key={pos}
value={pos}
>

{pos}

</option>

))}

</select>
<select
value={filters.coach}
onChange={(e)=>

setFilters({

...filters,

coach:e.target.value

})

}

className="rounded-xl bg-[#121922] border border-white/10 p-3"

>

<option value="">Entrenador</option>

{filterOptions.coaches.map(coach=>(

<option
    key={coach}
    value={coach}
>
    {coach}
</option>

))}

</select>
<select
value={filters.week}
onChange={(e)=>

setFilters({

...filters,

week:e.target.value

})

}

className="rounded-xl bg-[#121922] border border-white/10 p-3"

>

<option value="">Semana</option>

{filterOptions.weeks.map(week=>(

<option
    key={week}
    value={week}
>
    {week}
</option>

))}

</select>

<select
value={filters.strategy}
onChange={(e)=>

setFilters({

...filters,

strategy:e.target.value

})

}

className="rounded-xl bg-[#121922] border border-white/10 p-3"

>

<option value="">Estrategia</option>

{filterOptions.strategies.map(strategy=>(

<option
    key={strategy}
    value={strategy}
>
    {strategy}
</option>

))}

</select>

<button
onClick={() => setFilters(emptyFilters)}
className="rounded-xl bg-[#C8A96B] text-black font-semibold"
>
Limpiar
</button>
</div>
<br></br>
<div className="flex flex-wrap gap-2 mt-4">

{Object.entries(filters)

.filter(([_,value])=>value)

.map(([key,value])=>(

<button

key={key}

onClick={()=>updateFilter(
key as keyof typeof filters,
""
)}

className="
px-3
py-1
rounded-full
bg-[#C8A96B]
text-black
text-sm
"

>

{
key==="player"
? playerMap[value]?.nombre
: value
} ✕

</button>

))}

</div>
            <div className="hidden md:block h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />

          </div>
<div className="
flex
flex-wrap
items-center
gap-3
rounded-2xl
bg-[#121922]
border
border-white/10
px-5
py-3
mb-6
">
<span className="text-white/60">
Mostrando
</span>

<span className="font-bold text-[#C8A96B]">
{totalSessions}
</span>

<span className="text-white/60">
seguimientos
</span>

</div><div className="flex flex-wrap gap-2 mt-3">

{filters.position && (

<span className="px-3 py-1 rounded-full bg-[#C8A96B]/15 text-[#C8A96B]">

Posición:
{filters.position}

</span>

)}

{filters.coach && (

<span className="px-3 py-1 rounded-full bg-[#C8A96B]/15 text-[#C8A96B]">

Entrenador:
{filters.coach}

</span>

)}

{filters.week && (

<span className="px-3 py-1 rounded-full bg-[#C8A96B]/15 text-[#C8A96B]">

Semana:
{filters.week}

</span>

)}
 
{filters.strategy && (

<span className="px-3 py-1 rounded-full bg-[#C8A96B]/15 text-[#C8A96B]">

Estrategia:
{filters.strategy}

</span>

)}

</div>
          {/* KPIs */}

          <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 md:gap-5 mt-5">

            <div className="rounded-3xl border border-white/10 bg-[#121922] p-6 text-6xl hover:border-[#C8A96B]
hover:cursor-pointer
transition">

              <p className="text-white/50 text-sm">
                Seguimientos
              </p>

              <h2 className="mt-3 text-5xl font-bold text-[#C8A96B]">
                {totalSessions}
              </h2>

            </div>

            <div className="rounded-3xl border border-white/10 bg-[#121922] p-6 text-4xl hover:border-[#C8A96B]
hover:cursor-pointer
transition">

              <p className="text-white/50 text-sm">
                Jugadores
              </p>

              <h2 className="mt-3 text-5xl font-bold">
                {totalPlayers}
              </h2>

            </div>

            <div className="rounded-3xl border border-white/10 bg-[#121922] p-6 text-4xl hover:border-[#C8A96B]
hover:cursor-pointer
transition">

              <p className="text-white/50 text-sm">
                Media semanal
              </p>

              <h2 className="mt-3 text-5xl font-bold">
                {averageWeek}
              </h2>

            </div>

            <div className="rounded-3xl border border-white/10 bg-[#121922] p-6 text-4xl hover:border-[#C8A96B]
hover:cursor-pointer
transition">

              <p className="text-white/50 text-sm">
                Jugador más seguido
              </p>

              <h2 className="mt-3 text-2xl font-bold text-[#C8A96B]">
                {mostTrackedPlayer.name}
              </h2>
              <p className="mt-2 text-sm text-white/50">
{mostTrackedPlayer.value} seguimientos
</p>

            </div>
<div className="rounded-3xl border border-white/10 bg-[#121922] p-6 text-4xl hover:border-[#C8A96B]
hover:cursor-pointer
transition">

  <p className="text-white/50 text-sm">
    Jugador menos seguido
  </p>

  <h2 className="mt-3 text-2xl font-bold text-[#C8A96B]">
    {leastTrackedPlayer.name}
  </h2>

  <p className="mt-2 text-sm text-white/50">
    {leastTrackedPlayer.value} seguimientos
  </p>

</div>
          </div>

          {/* FILA 1 */}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-10">

            {/* BARRAS */}

            <div className="rounded-3xl border border-white/10 bg-[#121922] p-6">

              <h3 className="mb-6 text-base md:text-lg font-semibold">
                Seguimientos por jugador
              </h3>
<div className="overflow-x-auto">
  <div className="min-w-[900px] h-[320px]">
              <ResponsiveContainer width="100%" height={320}>

                <BarChart data={playerChart}>

                  <CartesianGrid stroke="#333" />

                  <XAxis
    dataKey="name"
    interval={0}
    angle={-55}
    textAnchor="end"
    height={95}
    tick={{
        fill:"#999",
        fontSize:9
    }}
/>

                  <YAxis
                    tick={{ fill: "#999" }}

                  />

                  <Tooltip />

                  <Bar
    dataKey="value"
    radius={[6,6,0,0]}
    onClick={(data:any)=>{

        const nombre =
            data.payload?.name ?? data.name;

        const jugador =
            players.find(
                p=>p.nombre===nombre
            );

        if(jugador){

            updateFilter(
                "player",
                jugador.id
            );

        }

    }}
>

{playerChart.map((item)=>(

<Cell

key={item.name}

fill={

filters.player

? item.name === playerMap[filters.player]?.nombre

    ? "#C8A96B"

    : "#444"

: "#C8A96B"

}

/>

))}

</Bar>

                </BarChart>

              </ResponsiveContainer>
 </div>
</div>
            </div>

            {/* PIE */}

            <div className="rounded-3xl border border-white/10 bg-[#121922] p-6">

              <h3 className="mb-6 text-base md:text-lg font-semibold">
                Estrategias utilizadas
              </h3>
<div className="overflow-x-auto">
  <div className="min-w-[700px] h-[350px]">
              <ResponsiveContainer width="100%" height={350}>

                <PieChart>

                  <Pie
onClick={(data:any)=>{

if(!data?.name && !data?.payload) return;

setFilters({
    ...filters,
    strategy:data.payload?.name ?? data.name
});

}}
                    data={strategyData}

                    dataKey="value"

                    nameKey="name"

                    outerRadius={120}
                    innerRadius={45}

                    label={false}

                  >

                    {strategyData.map((item,i)=>(

                      <Cell

fill={

filters.strategy

? item.name===filters.strategy

    ? COLORS[i]

    : "#444"

: COLORS[i]

}

/>

                    ))}
<Legend/>
                  </Pie>

                  <Tooltip />

                </PieChart>

              </ResponsiveContainer>

            </div>

          </div> </div>

          </div>

          {/* FILA 2 */}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">

            {/* EVOLUCIÓN */}

            <div className="rounded-3xl border border-white/10 bg-[#121922] p-6">

              <h3 className="mb-6 text-base md:text-lg font-semibold">
                Evolución semanal
              </h3>
<div className="overflow-x-auto">
  <div className="min-w-[700px] h-[350px]">
              <ResponsiveContainer width="100%" height={350}>

                <LineChart data={weeklyData} onClick={(state:any)=>{

if(!state?.activeLabel) return;

setFilters({
    ...filters,
    week:String(state.activeLabel)
});

}}
>

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

                    strokeWidth={4}dot={{

r:5

}}

                  />

                </LineChart>

              </ResponsiveContainer>

            </div> </div> </div>

            {/* RADAR */}

            <div className="rounded-3xl border border-white/10 bg-[#121922] p-6">

              <h3 className="mb-6 text-base md:text-lg font-semibold">
                Distribución estrategias
              </h3>
<div className="overflow-x-auto">
  <div className="min-w-[450px] h-[350px]">
              <ResponsiveContainer width="100%" height={350}>

                <RadarChart
data={strategyData}

onClick={(data:any)=>{

if(!data?.activePayload) return;

setFilters({

...filters,

strategy:data.activePayload[0].payload.name

});

}}
outerRadius={120}
>

                  <PolarGrid/>

                  <PolarAngleAxis
                    dataKey="name"
                  />

                  <PolarRadiusAxis/>
tick={false}
                  <Radar

                    dataKey="value"

                    stroke="#C8A96B"

                    fill="#C8A96B"

                    fillOpacity={
filters.strategy
?0.15
:0.45
}

                  />

                </RadarChart>

              </ResponsiveContainer>
</div>

          </div>
            </div>

          </div>

        </div>

      </section>

    </div>

  </main>
);
}