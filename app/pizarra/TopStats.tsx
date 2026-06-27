"use client";

import { usePlayers } from "@/hooks/usePlayers";

export default function TopStats(){

const {players}=usePlayers();

const disponibles=players.filter(p=>p.estado==="DISPONIBLE").length;

const lesionados=players.filter(p=>p.estado==="LESIONADO").length;

const seleccion=players.filter(p=>p.estado==="SELECCIÓN").length;

const primerEquipo=players.filter(p=>p.estado==="PRIMER EQUIPO").length;

const noCastilla=players.filter(
p=>p.licencia!=="RMCF Castilla"
).length;

const Card=({title,value,color}:any)=>(

<div className={`
rounded-xl
${color}
px-4
py-3
min-w-[120px]
`}>

<div className="text-xs opacity-80">

{title}

</div>

<div className="text-2xl font-bold">

{value}

</div>

</div>

);

return(

<div className="
flex
gap-3
overflow-x-auto
border-b
border-white/10
bg-zinc-950
p-4
text-white
">

<Card
title="Disponibles"
value={disponibles}
color="bg-green-700"
/>

<Card
title="Lesionados"
value={lesionados}
color="bg-red-700"
/>

<Card
title="Primer Equipo"
value={primerEquipo}
color="bg-yellow-500 text-black"
/>

<Card
title="Selección"
value={seleccion}
color="bg-blue-700"
/>

<Card
title="No Castilla"
value={`${noCastilla}/4`}
color={
noCastilla>4
?"bg-red-700"
:"bg-emerald-700"
}
/>

</div>

)

}