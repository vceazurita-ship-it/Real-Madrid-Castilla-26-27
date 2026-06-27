"use client";

const formations = [

"4-4-2",

"4-3-3",

"4-2-3-1",

"3-5-2",

"3-4-3"

];

export default function FormationToolbar(){

return(

<div className="
flex
items-center
justify-between
border-b
border-white/10
bg-zinc-900
px-5
py-3
">

<div className="flex gap-2">

{formations.map(f=>(

<button

key={f}

className="
rounded-lg
bg-zinc-800
px-4
py-2
text-sm
text-white
hover:bg-zinc-700
"

>

{f}

</button>

))}

</div>

<div className="flex gap-3">

<button className="rounded-lg bg-red-600 px-4 py-2 text-white">

Reset

</button>

<button className="rounded-lg bg-emerald-600 px-4 py-2 text-white">

Guardar

</button>

</div>

</div>

)

}