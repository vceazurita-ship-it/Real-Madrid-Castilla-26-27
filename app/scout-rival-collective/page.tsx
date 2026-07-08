"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useEffect, useState } from "react"
import Link from "next/link";

export default function ScoutRivalCollective() {
  const [rivales, setRivales] = useState<any[]>([])
const [rivalActivo, setRivalActivo] = useState<any>(null)
const [modoEdicion, setModoEdicion] = useState(false)
const [guardando, setGuardando] = useState(false)


const guardarRival = async () => {

  setGuardando(true);

  try {

    const body = new URLSearchParams();

body.append("action", "guardarRival");

Object.entries(rivalActivo).forEach(([key, value]) => {
  body.append(key, String(value ?? ""));
});

const res = await fetch(
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec",
  {
    method: "POST",
    body,
  }
);

    const data = await res.json();

    if (data.success) {
      alert("Informe guardado correctamente");
      setModoEdicion(false);
    } else {
      alert("Error al guardar: "+rivalActivo.ID);
    }

  } finally {
    setGuardando(false);
  }
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

        <div className="p-5 md:p-10">

          <div className="flex items-start justify-between mb-10">

  <div>
    <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
      SCOUTING COLECTIVO
    </p>

    <h1 className="mt-2 text-5xl font-black tracking-tight">
      {rivalActivo?.EQUIPO}
    </h1>

    <p className="mt-3 text-white/50">
      Informe del rival
    </p>
  </div>

  <div className="flex gap-3">

    <Link
      href="/plan-partido"
      className="
      rounded-2xl
      bg-[#C8A96B]
      px-6
      py-3
      font-semibold
      text-black
      hover:scale-105
      transition
      "
    >
      Plan de Partido
    </Link>

    {modoEdicion && (
      <button
        disabled={guardando}
        onClick={guardarRival}
        className="rounded-2xl bg-green-600 px-6 py-3"
      >
        {guardando ? "Guardando..." : "Guardar"}
      </button>
    )}

    <button
      onClick={() => setModoEdicion(!modoEdicion)}
      className="rounded-2xl border border-[#C8A96B]/40 px-6 py-3"
    >
      {modoEdicion ? "Cancelar" : "Editar"}
    </button>

  </div>

</div>

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
  J{r.JORNADA} · {r.EQUIPO}
</option>

    ))}

  </select>

<div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">

  <div className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
shadow-lg
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]
">
    <p className="text-xs uppercase text-white/40">
      Jornada
    </p>

    {modoEdicion ? (
      <input
        value={rivalActivo?.JORNADA || ""}
        onChange={(e) =>
          setRivalActivo({
            ...rivalActivo,
            JORNADA: e.target.value,
          })
        }
        className="mt-2 w-full rounded-xl bg-[#0B0F14] p-2"
      />
    ) : (
      <p className="mt-2 text-xl font-bold">
        {rivalActivo?.JORNADA}
      </p>
    )}
  </div>

  <div className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
shadow-lg
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]
">
    <p className="text-xs uppercase text-white/40">
      Fecha
    </p>

    {modoEdicion ? (
      <input
        value={rivalActivo?.FECHA || ""}
        onChange={(e) =>
          setRivalActivo({
            ...rivalActivo,
            FECHA: e.target.value,
          })
        }
        className="mt-2 w-full rounded-xl bg-[#0B0F14] p-2"
      />
    ) : (
      <p className="mt-2 text-xl font-bold">
        {rivalActivo?.FECHA
  ? new Date(rivalActivo.FECHA).toLocaleDateString("es-ES")
  : ""}
      </p>
    )}
  </div>

  <div className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
shadow-lg
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]
">
    <p className="text-xs uppercase text-white/40">
      Local / Visitante
    </p>

    {modoEdicion ? (
      <input
        value={rivalActivo?.LOCAL_VISITANTE || ""}
        onChange={(e) =>
          setRivalActivo({
            ...rivalActivo,
            LOCAL_VISITANTE: e.target.value,
          })
        }
        className="mt-2 w-full rounded-xl bg-[#0B0F14] p-2"
      />
    ) : (
      <p className="mt-2 text-xl font-bold">
        {rivalActivo?.LOCAL_VISITANTE}
      </p>
    )}
  </div>

</div>
<div className="mt-10 rounded-3xl border border-[#C8A96B]/20 bg-gradient-to-br from-[#C8A96B]/10 to-[#111827] p-8">

  <h2 className="text-xl font-semibold text-[#C8A96B] mb-6">
    Recursos
  </h2>

  <div className="grid md:grid-cols-3 gap-6">

    <div>
      <p className="mb-2 text-sm text-white/50">
        Vídeo
      </p>

      {modoEdicion ? (

        <input
          value={rivalActivo?.VIDEO || ""}
          onChange={(e) =>
            setRivalActivo({
              ...rivalActivo,
              VIDEO: e.target.value,
            })
          }
          className="
          w-full
          rounded-2xl
          border
          border-white/10
          bg-[#111827]
          p-4
          text-white
          "
        />

      ) : (

        rivalActivo?.VIDEO && (
          <a
            href={rivalActivo.VIDEO}
            target="_blank"
            rel="noreferrer"
            className="
            inline-block
            rounded-2xl
            border
            border-[#C8A96B]/30
            bg-[#C8A96B]/10
            px-6
            py-3
            font-semibold
            text-[#C8A96B]
            "
          >
            Ver Vídeo
          </a>
        )

      )}
    </div>

    <div>
      <p className="mb-2 text-sm text-white/50">
        Documento
      </p>

      {modoEdicion ? (

        <input
          value={rivalActivo?.DOC || ""}
          onChange={(e) =>
            setRivalActivo({
              ...rivalActivo,
              DOC: e.target.value,
            })
          }
          className="
          w-full
          rounded-2xl
          border
          border-white/10
          bg-[#111827]
          p-4
          text-white
          "
        />

      ) : (

        rivalActivo?.DOC && (
          <a
            href={rivalActivo.DOC}
            target="_blank"
            rel="noreferrer"
            className="
            inline-block
            rounded-2xl
            border
            border-[#C8A96B]/30
            bg-[#C8A96B]/10
            px-6
            py-3
            font-semibold
            text-[#C8A96B]
            "
          >
            Abrir Informe
          </a>
        )

      )}
        </div>

    <div>
      <p className="mb-2 text-sm text-white/50">
        Plan de Partido
      </p>

      <a
        href="#"
        target="_blank"
        rel="noreferrer"
        className="
        inline-block
        rounded-2xl
        border
        border-[#C8A96B]/30
        bg-[#C8A96B]/10
        px-6
        py-3
        font-semibold
        text-[#C8A96B]
        "
      >
        Abrir Plan
      </a>
    </div>

  </div>

</div>
<div className="mt-10 grid gap-y-8 gap-x-6 xl:grid-cols-3">

  <section
className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]
"
>

  <h2 className="mb-4 text-sm uppercase tracking-[0.30em] text-[#C8A96B]">
    Estructura Ofensiva
  </h2>

  {modoEdicion ? (

    <textarea
      value={rivalActivo?.ESTRUCTURA_OF || ""}
      onChange={(e) =>
        setRivalActivo({
          ...rivalActivo,
          ESTRUCTURA_OF: e.target.value,
        })
      }
      rows={8}
      className="
      mt-4
      w-full
      rounded-2xl
      border
      border-white/10
      bg-[#111827]
      p-4
      text-white
      "
    />

  ) : (

    <p className="mt-4 text-white/70 whitespace-pre-wrap">
      {rivalActivo?.ESTRUCTURA_OF}
    </p>

  )}

</section>

 <section className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]">

  <h2 className="text-xl font-semibold text-blue-400">
    Estructura Defensiva
  </h2>

  {modoEdicion ? (

    <textarea
      value={rivalActivo?.ESTRUCTURA_DEF || ""}
      onChange={(e) =>
        setRivalActivo({
          ...rivalActivo,
          ESTRUCTURA_DEF: e.target.value,
        })
      }
      rows={8}
      className="
      mt-4
      w-full
      rounded-2xl
      border
      border-white/10
      bg-[#111827]
      p-4
      text-white
      "
    />

  ) : (

    <p className="mt-4 text-white/70 whitespace-pre-wrap">
      {rivalActivo?.ESTRUCTURA_DEF}
    </p>

  )}

</section>
 <section className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]">

  <h2 className="text-2xl font-bold tracking-tight">
    Ataque
  </h2>

  {modoEdicion ? (

    <textarea
      value={rivalActivo?.ATAQUE || ""}
      onChange={(e) =>
        setRivalActivo({
          ...rivalActivo,
          ATAQUE: e.target.value,
        })
      }
      rows={8}
      className="mt-4 w-full rounded-2xl border border-white/10 bg-[#111827] p-4 text-white"
    />

  ) : (

    <p className="leading-8 text-white/80 whitespace-pre-wrap">
      {rivalActivo?.ATAQUE}
    </p>

  )}

</section>

  <section className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]">

  <h2 className="text-xl font-semibold">
    Defensa
  </h2>

  {modoEdicion ? (

    <textarea
      value={rivalActivo?.DEFENSA || ""}
      onChange={(e) =>
        setRivalActivo({
          ...rivalActivo,
          DEFENSA: e.target.value,
        })
      }
      rows={8}
      className="mt-4 w-full rounded-2xl border border-white/10 bg-[#111827] p-4 text-white"
    />

  ) : (

    <p className="leading-8 text-white/80 whitespace-pre-wrap">
      {rivalActivo?.DEFENSA}
    </p>

  )}

</section>

 <section className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]">

  <h2 className="text-xl font-semibold">
    Transición Ofensiva
  </h2>

  {modoEdicion ? (

    <textarea
      value={rivalActivo?.TRANSICION_OF || ""}
      onChange={(e) =>
        setRivalActivo({
          ...rivalActivo,
          TRANSICION_OF: e.target.value,
        })
      }
      rows={8}
      className="mt-4 w-full rounded-2xl border border-white/10 bg-[#111827] p-4 text-white"
    />

  ) : (

    <p className="leading-8 text-white/80 whitespace-pre-wrap">
      {rivalActivo?.TRANSICION_OF}
    </p>

  )}

</section>

  <section className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]">

  <h2 className="text-xl font-semibold">
    Transición Defensiva
  </h2>

  {modoEdicion ? (

    <textarea
      value={rivalActivo?.TRANSICION_DEF || ""}
      onChange={(e) =>
        setRivalActivo({
          ...rivalActivo,
          TRANSICION_DEF: e.target.value,
        })
      }
      rows={8}
      className="mt-4 w-full rounded-2xl border border-white/10 bg-[#111827] p-4 text-white"
    />

  ) : (

    <p className="leading-8 text-white/80 whitespace-pre-wrap">
      {rivalActivo?.TRANSICION_DEF}
    </p>

  )}

</section>

 <section className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]">

  <h2 className="mb-4 text-sm uppercase tracking-[0.30em] text-[#C8A96B]">
    Estructura Transición Ofensiva
  </h2>

  {modoEdicion ? (

    <textarea
      value={rivalActivo?.ESTRUCTURA_TR_OF || ""}
      onChange={(e) =>
        setRivalActivo({
          ...rivalActivo,
          ESTRUCTURA_TR_OF: e.target.value,
        })
      }
      rows={8}
      className="mt-4 w-full rounded-2xl border border-white/10 bg-[#111827] p-4 text-white"
    />

  ) : (

    <p className="mt-4 text-white/70 whitespace-pre-wrap">
      {rivalActivo?.ESTRUCTURA_TR_OF}
    </p>

  )}

</section>

  <section className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]">

  <h2 className="text-xl font-semibold text-blue-400">
    Estructura Transición Defensiva
  </h2>

  {modoEdicion ? (

    <textarea
      value={rivalActivo?.ESTRUCTURA_TR_DEF || ""}
      onChange={(e) =>
        setRivalActivo({
          ...rivalActivo,
          ESTRUCTURA_TR_DEF: e.target.value,
        })
      }
      rows={8}
      className="mt-4 w-full rounded-2xl border border-white/10 bg-[#111827] p-4 text-white"
    />

  ) : (

    <p className="mt-4 text-white/70 whitespace-pre-wrap">
      {rivalActivo?.ESTRUCTURA_TR_DEF}
    </p>

  )}

</section>

  <section className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]">

  <h2 className="text-xl font-semibold text-violet-400">
    ABP Ofensivo
  </h2>

  {modoEdicion ? (

    <textarea
      value={rivalActivo?.ABP_OF || ""}
      onChange={(e) =>
        setRivalActivo({
          ...rivalActivo,
          ABP_OF: e.target.value,
        })
      }
      rows={8}
      className="mt-4 w-full rounded-2xl border border-white/10 bg-[#111827] p-4 text-white"
    />

  ) : (

    <p className="mt-4 text-white/70 whitespace-pre-wrap">
      {rivalActivo?.ABP_OF}
    </p>

  )}

</section>

  <section className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]">

  <h2 className="text-xl font-semibold text-violet-400">
    ABP Defensivo
  </h2>

  {modoEdicion ? (

    <textarea
      value={rivalActivo?.ABP_DEF || ""}
      onChange={(e) =>
        setRivalActivo({
          ...rivalActivo,
          ABP_DEF: e.target.value,
        })
      }
      rows={8}
      className="mt-4 w-full rounded-2xl border border-white/10 bg-[#111827] p-4 text-white"
    />

  ) : (

    <p className="mt-4 text-white/70 whitespace-pre-wrap">
      {rivalActivo?.ABP_DEF}
    </p>

  )}

</section>

  <section className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]">

  <h2 className="text-xl font-semibold text-green-400">
    Fortalezas
  </h2>

  {modoEdicion ? (

    <textarea
      value={rivalActivo?.FORTALEZAS || ""}
      onChange={(e) =>
        setRivalActivo({
          ...rivalActivo,
          FORTALEZAS: e.target.value,
        })
      }
      rows={8}
      className="
      mt-4
      w-full
      rounded-2xl
      border
      border-white/10
      bg-[#111827]
      p-4
      text-white
      "
    />

  ) : (

    <ul className="mt-4 space-y-2 text-white/70">
      {rivalActivo?.FORTALEZAS
        ?.split(";")
        ?.map((item: string) => (
          <li key={item}>
            • {item}
          </li>
        ))}
    </ul>

  )}

</section>

 <section className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]">

  <h2 className="text-xl font-semibold text-red-400">
    Debilidades
  </h2>

  {modoEdicion ? (

    <textarea
      value={rivalActivo?.DEBILIDADES || ""}
      onChange={(e) =>
        setRivalActivo({
          ...rivalActivo,
          DEBILIDADES: e.target.value,
        })
      }
      rows={8}
      className="
      mt-4
      w-full
      rounded-2xl
      border
      border-white/10
      bg-[#111827]
      p-4
      text-white
      "
    />

  ) : (

    <ul className="mt-4 space-y-2 text-white/70">
      {rivalActivo?.DEBILIDADES
        ?.split(";")
        ?.map((item: string) => (
          <li key={item}>
            • {item}
          </li>
        ))}
    </ul>

  )}

</section>

</div>

<section className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]">
  <h2 className="text-xl font-semibold text-amber-400">
    Jugadores Clave
  </h2>

  {modoEdicion ? (

  <textarea
    value={rivalActivo?.JUGADORES_CLAVE || ""}
    onChange={(e) =>
      setRivalActivo({
        ...rivalActivo,
        JUGADORES_CLAVE: e.target.value,
      })
    }
    rows={6}
    className="mt-4 w-full rounded-2xl border border-white/10 bg-[#111827] p-4 text-white"
  />

) : (

  <p className="mt-4 text-white/70 whitespace-pre-wrap">
    {rivalActivo?.JUGADORES_CLAVE}
  </p>

)}
</section>

<section className="
group
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
transition-all
duration-300
hover:border-[#C8A96B]/30
hover:bg-neutral-800/70
hover:shadow-[0_0_20px_rgba(212,176,106,0.08)]">
  <h2 className="text-xl font-semibold">
    Observaciones
  </h2>

  {modoEdicion ? (

  <textarea
    value={rivalActivo?.OBSERVACIONES || ""}
    onChange={(e) =>
      setRivalActivo({
        ...rivalActivo,
        OBSERVACIONES: e.target.value,
      })
    }
    rows={8}
    className="mt-4 w-full rounded-2xl border border-white/10 bg-[#111827] p-4 text-white"
  />

) : (

  <p className="mt-4 text-white/70 whitespace-pre-wrap">
    {rivalActivo?.OBSERVACIONES}
  </p>

)}
</section>


          
        </div>
      </main>
    </div>
  );
}