"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useEffect, useState } from "react"
import {
  ExternalLink,
  Copy,
  CheckCircle2,
  XCircle,
  FileText,
  Film
} from "lucide-react";
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

  const json = await res.json();
console.log(json);
return json;

}
const copiarEnlace = (url:string)=>{

    if(!url) return;

    navigator.clipboard.writeText(url);

    alert("Enlace copiado");

}
function ResourceCard({
  titulo,
  campo,
  icono,
}: {
  titulo: string;
  campo: keyof typeof rivalActivo;
  icono: React.ReactNode;
}) {
  const valor = rivalActivo?.[campo];

  return (
    <div className="
      rounded-3xl
      border
      border-white/10
      bg-white/5
      backdrop-blur-md
      p-6
      hover:scale-[1.02]
      transition-all
      duration-200
    ">

      <div className="flex justify-between items-center">

        <div className="flex items-center gap-3">
          {icono}
          <h3 className="text-lg font-bold">{titulo}</h3>
        </div>

        {valor ? (
          <CheckCircle2 className="text-green-400" />
        ) : (
          <XCircle className="text-red-400" />
        )}

      </div>

      <div className="mt-5">

        {modoEdicion ? (

          <input
            value={valor || ""}
            onChange={(e)=>
              setRivalActivo({
                ...rivalActivo,
                [campo]: e.target.value
              })
            }
            className="
              w-full
              rounded-xl
              bg-white/5 backdrop-blur-md
              border
              border-white/10
              p-3
            "
          />

        ) : (

          <p className="text-sm text-white/60 break-all">

            {valor
              ? valor.replace(/^https?:\/\//,"")
              : "Sin enlace"}

          </p>

        )}

      </div>

      <div className="flex gap-3 mt-6">

        <button
          onClick={()=>copiarEnlace(valor)}
          className="rounded-xl bg-white/5 px-4 py-2 hover:bg-white/10 flex items-center gap-2"
        >
          <Copy size={16}/>
          Copiar
        </button>

        {valor ? (

          <a
            href={valor}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-[#C8A96B]/10 px-4 py-2 hover:bg-[#C8A96B]/20 flex items-center gap-2"
          >
            <ExternalLink size={16}/>
            Abrir
          </a>

        ) : (

          <span className="text-red-400 text-sm self-center">
            Sin enlace
          </span>

        )}

      </div>

    </div>
  );
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
      focus:ring-2
focus:ring-[#C8A96B]
transition
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
rounded-xl
bg-[#C8A96B]
px-6
py-3
font-semibold
text-black
hover:opacity-90
transition
disabled:opacity-50
"
  >
    {guardando ? (

<div className="flex items-center gap-2">

<div className="
animate-spin
h-5
w-5
rounded-full
border-2
border-white
border-t-transparent
"/>

<span>Guardando...</span>

</div>

) : (

"Guardar Cambios"

)}
  </button>

)}

  <button
    onClick={() => setModoEdicion(!modoEdicion)}
    className="
rounded-xl
border
border-[#C8A96B]
px-6
py-3
font-semibold
text-[#C8A96B]
hover:bg-[#C8A96B]/10
tran
"
  >
    {modoEdicion ? "Cancelar" : "Editar Informe"}
  </button>

</div>
<div className="grid gap-6 lg:grid-cols-3 mb-8">

  <div className="rounded-3xl border border-[#C8A96B]/20 bg-white/5 backdrop-blur-md p-6 hover:shadow-2xl
hover:border-[#C8A96B]/40
transition-all
duration-300">

    <p className="text-xs uppercase tracking-widest text-white/40">
      Rival
    </p>

    <h2 className="mt-3 text-3xl font-bold">
      {rivalActivo?.EQUIPO}
    </h2>

    <div className="mt-6 flex gap-6">

      <div>
        <p className="text-xs text-white/40 ">
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

  <div
  className="
rounded-3xl
border
border-white/10
bg-gradient-to-br
from-white/[0.05]
to-white/[0.02]
p-6 
hover:border-red-400/40
transition-all
duration-300
">

<h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">      Fortalezas
    </h3>

<ul className="mt-6 space-y-3 text-white/80 leading-7">
      {rivalActivo?.FORTALEZAS
        ?.split(";")
        ?.map((item:string)=>(
          <li key={item}>
            • {item}
          </li>
      ))}

    </ul>

  </div>

  <div
  className="
rounded-3xl
border
border-white/10
bg-gradient-to-br
from-white/[0.05]
to-white/[0.02]
p-6
hover:border-red-400/40
transition-all
duration-300
">

<h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">      Debilidades
    </h3>

<ul className="mt-6 space-y-3 text-white/80 leading-7">
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
<section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8 mb-8 hover:shadow-2xl
hover:border-[#C8A96B]/40
transition-all
duration-300">

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
bg-white/5
backdrop-blur-md focus:border-[#C8A96B]
focus:ring-2
focus:ring-[#C8A96B]/30
p-5
border
border-white/10
"
/>

</section>
<div className="grid gap-6 lg:grid-cols-2 mb-8 hover:shadow-2xl
hover:border-[#C8A96B]/40
transition-all
duration-300">

  <div
  className="
rounded-3xl
border
border-white/10
bg-gradient-to-br
from-white/[0.05]
to-white/[0.02]
p-6
hover:border-red-400/40
transition-all
duration-300
">

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
      bg-white/5
backdrop-blur-md focus:border-[#C8A96B]
focus:ring-2
focus:ring-[#C8A96B]/30
      border
      border-white/10
      p-4
      "
    />

  </div>

  <section className="rounded-3xl border border-yellow-500/20 bg-yellow-500/5 p-6 hover:shadow-2xl
hover:border-[#C8A96B]/40
transition-all
duration-300">

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
      bg-white/5
backdrop-blur-md focus:border-[#C8A96B]
focus:ring-2
focus:ring-[#C8A96B]/30
      border
      border-white/10
      p-4
      "
    />

  </section>
<section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-6 mb-8 hover:shadow-2xl
hover:border-[#C8A96B]/40
transition-all
duration-300">

<h2 className="text-xl font-bold mb-5">
Estructuras Rival
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

bg-white/5
backdrop-blur-md focus:border-[#C8A96B]
focus:ring-2
focus:ring-[#C8A96B]/30

border

border-white/10

p-4

"

/>

</section>
</div>
<section className="rounded-3xl border border-[#C8A96B]/20 bg-gradient-to-br from-[#C8A96B]/10 to-[#111827] p-8 hover:shadow-2xl hover:border-[#C8A96B]/40 transition-all duration-300">

<div className="flex justify-between items-center mb-8">

  <div>

    <h2 className="text-2xl font-bold text-[#C8A96B]">
      HUDL & Recursos
    </h2>

    <p className="text-sm text-white/50 mt-2">

      {
        [
          rivalActivo?.HUDL_PLAYLIST,
          rivalActivo?.HUDL_PARTIDO,
          rivalActivo?.HUDL_ANALISIS,
          rivalActivo?.DOC
        ].filter(Boolean).length
      }{" "}
      de 4 recursos disponibles

    </p>

  </div>

</div>

<div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">

  <ResourceCard
    titulo="Playlist"
    campo="HUDL_PLAYLIST"
    icono={<Film className="text-[#C8A96B]" />}
  />

  <ResourceCard
    titulo="Partido Completo"
    campo="HUDL_PARTIDO"
    icono={<Film className="text-[#C8A96B]" />}
  />

  <ResourceCard
    titulo="Análisis"
    campo="HUDL_ANALISIS"
    icono={<Film className="text-[#C8A96B]" />}
  />

  <ResourceCard
    titulo="Informe Rival"
    campo="DOC"
    icono={<FileText className="text-[#C8A96B]" />}
  />

</div>

</section>
          
        </div>
      </main>
    </div>
  );
}