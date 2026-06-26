"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useEffect, useState } from "react"

export default function MatchPreparation() {
  const [rivales, setRivales] = useState<any[]>([])
const [rivalActivo, setRivalActivo] = useState<any>(null)
const [modoEdicion, setModoEdicion] = useState(false)
const [guardando, setGuardando] = useState(false)

const guardarTodo = async () => {

  setGuardando(true);

  try {

  const res = await guardarRival();

if (res.success) {

  alert("Plan de partido guardado correctamente");

  setModoEdicion(false);

} else {

  alert("Error al guardar");

}

  } finally {

    setGuardando(false);

  }

};
const guardarRival = async () => {

  const body = new URLSearchParams();

  body.append("action", "guardarRival");

  Object.entries(rivalActivo).forEach(([key, value]) => {
    body.append(key, String(value ?? ""));
  });

  const res = await fetch(
"https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec",
{
    method:"POST",
    body
}
);

  return await res.json();

}
 
useEffect(() => {
  console.log(rivalActivo);
  fetch(
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec?action=rivales"
)
    .then(r => r.json())
    .then(data => {

      setRivales(data)

      if (data.length > 0) {

  setRivalActivo(data[0])

}
  
    })

}, [])

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="flex-1">
        <Topbar />

        <div className="p-6 md:p-10">

          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
  RMCF CASTILLA METODOLOGÍA
</p>

<h1 className="mt-2 text-4xl font-bold">
  Plan de Partido
</h1>

<p className="mt-3 text-white/60">
  Estrategia operativa.
</p>
          </div>
          <div className="mb-8">

  <select
    value={rivalActivo?.ID || ""}
    onChange={(e) => {

      const rival = rivales.find(
        r => String(r.ID) === e.target.value
      )

      setRivalActivo(rival)
    }}
    className="
      w-full
      rounded-2xl
      border
      border-white/10
     bg-[#111827]
text-lg
font-semibold
shadow-lg
border-white/5
      px-4
      py-4
      text-white
    "
  >

    {rivales.map((r) => (

      <option
        key={r.ID}
        value={r.ID}
      >
        {r.EQUIPO}
      </option>

    ))}

  </select>

</div>

<div className="flex justify-end gap-4 mb-6">

 {modoEdicion && (

  <button
    disabled={guardando}
    onClick={guardarTodo}
    className="
    rounded-2xl
    border
    border-green-500/30
    bg-green-500/10
    px-6
    py-3
    font-semibold
    text-green-400
    hover:bg-green-500/20
    disabled:opacity-50
    "
  >
    {guardando
      ? "Guardando..."
      : "Guardar Cambios"}
  </button>

)}

  <button
    onClick={() => setModoEdicion(!modoEdicion)}
    className="
    rounded-2xl
    border
    border-[#C8A96B]/30
    bg-[#C8A96B]/10
    px-6
    py-3
    font-semibold
    text-[#C8A96B]
    hover:bg-[#C8A96B]/20
    "
  >
    {modoEdicion ? "Cancelar" : "Editar Informe"}
  </button>

</div>
<div className="grid gap-6 lg:grid-cols-3 mb-8">

  <div className="rounded-3xl border border-[#C8A96B]/20 bg-[#111827] p-6">

    <p className="text-xs uppercase tracking-widest text-white/40">
      Rival
    </p>

    <h2 className="mt-3 text-3xl font-bold">
      {rivalActivo?.EQUIPO}
    </h2>

    <div className="mt-6 flex gap-6">

      <div>
        <p className="text-xs text-white/40">
          Jornada
        </p>

        <p className="mt-1 text-xl font-semibold">
          {rivalActivo?.JORNADA}
        </p>
      </div>

      <div>
        <p className="text-xs text-white/40">
          Partido
        </p>

        <p className="mt-1 text-xl font-semibold">
          {rivalActivo?.LOCAL_VISITANTE}
        </p>
      </div>

    </div>

  </div>

  <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6">

    <p className="text-xs uppercase tracking-widest text-cyan-300">
      Fortalezas
    </p>

    <ul className="mt-5 space-y-2 text-white/80">

      {rivalActivo?.FORTALEZAS
        ?.split(";")
        ?.map((item:string)=>(
          <li key={item}>
            • {item}
          </li>
      ))}

    </ul>

  </div>

  <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6">

    <p className="text-xs uppercase tracking-widest text-red-300">
      Vulnerabilidades
    </p>

    <ul className="mt-5 space-y-2 text-white/80">

      {rivalActivo?.DEBILIDADES
        ?.split(";")
        ?.map((item:string)=>(
          <li key={item}>
            • {item}
          </li>
      ))}

    </ul>

  </div>

</div>
<section className="rounded-3xl border border-white/10 bg-[#111827] p-8 mb-8">

<h2 className="text-2xl font-bold mb-6">
Plan de Partido
</h2>

<textarea
rows={12}
value={rivalActivo?.PLAN_PARTIDO || ""}
readOnly={!modoEdicion}
onChange={(e)=>
setRivalActivo({
  ...rivalActivo,
PLAN_PARTIDO:e.target.value
})
}
className="
w-full
rounded-2xl
bg-[#0B0F14]
p-5
border
border-white/10
"
/>

</section>
<div className="grid gap-6 lg:grid-cols-2 mb-8">

  <section className="rounded-3xl border border-blue-500/20 bg-blue-500/5 p-6">

    <h2 className="text-xl font-bold mb-5">
      Estado del Equipo
    </h2>

    <textarea
      rows={8}
      value={rivalActivo?.ESTADO_EQUIPO || ""}
      readOnly={!modoEdicion}
      onChange={(e)=>

       setRivalActivo({
  ...rivalActivo,
          ESTADO_EQUIPO:e.target.value
        })

      }
      className="
      w-full
      rounded-2xl
      bg-[#0B0F14]
      border
      border-white/10
      p-4
      "
    />

  </section>

  <section className="rounded-3xl border border-yellow-500/20 bg-yellow-500/5 p-6">

    <h2 className="text-xl font-bold mb-5">
      Claves del Partido
    </h2>

    <textarea
      rows={8}
      value={rivalActivo?.CLAVES_PARTIDO || ""}
      readOnly={!modoEdicion}
      onChange={(e)=>

        setRivalActivo({
  ...rivalActivo,
          CLAVES_PARTIDO:e.target.value
        })

      }
      className="
      w-full
      rounded-2xl
      bg-[#0B0F14]
      border
      border-white/10
      p-4
      "
    />

  </section>
<section className="rounded-3xl border border-white/10 bg-[#111827] p-6 mb-8">

<h2 className="text-xl font-bold mb-5">
Sistema Rival
</h2>

<input

value={rivalActivo?.SISTEMA_RIVAL || ""}

readOnly={!modoEdicion}

onChange={(e)=>

setRivalActivo({
  ...rivalActivo,

SISTEMA_RIVAL:e.target.value

})

}

className="

w-full

rounded-2xl

bg-[#0B0F14]

border

border-white/10

p-4

"

/>

</section>
</div>
<section className="rounded-3xl border border-[#C8A96B]/20 bg-gradient-to-br from-[#C8A96B]/10 to-[#111827] p-8">

<h2 className="text-2xl font-bold text-[#C8A96B] mb-8">
HUDL & Recursos
</h2>

<div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">

<a
href={rivalActivo?.VIDEO}
target="_blank"
className="rounded-2xl border border-white/10 bg-[#0B0F14] p-6 hover:border-[#C8A96B] transition">

<p className="text-sm text-white/50">
HUDL
</p>

<h3 className="mt-2 text-xl font-bold">
Playlist
</h3>

</a>

<a
href={rivalActivo?.HUDL_PARTIDO}
target="_blank"
className="rounded-2xl border border-white/10 bg-[#0B0F14] p-6 hover:border-[#C8A96B] transition">

<p className="text-sm text-white/50">
HUDL
</p>

<h3 className="mt-2 text-xl font-bold">
Partido Completo
</h3>

</a>

<a
href={rivalActivo?.HUDL_ANALISIS}
target="_blank"
className="rounded-2xl border border-white/10 bg-[#0B0F14] p-6 hover:border-[#C8A96B] transition">

<p className="text-sm text-white/50">
HUDL
</p>

<h3 className="mt-2 text-xl font-bold">
Análisis
</h3>

</a>

<a
href={rivalActivo?.DOC}
target="_blank"
className="rounded-2xl border border-white/10 bg-[#0B0F14] p-6 hover:border-[#C8A96B] transition">

<p className="text-sm text-white/50">
Documento
</p>

<h3 className="mt-2 text-xl font-bold">
Informe Rival
</h3>

</a>

</div>

</section>
          
        </div>
      </main>
    </div>
  );
}