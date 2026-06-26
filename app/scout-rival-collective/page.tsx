"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useEffect, useState } from "react"

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

        <div className="p-6 md:p-10">

          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              RMCF CASTILLA SCOUT RIVAL
            </p>

            <h1 className="mt-2 text-5xl font-bold tracking-tight">
            {rivalActivo?.EQUIPO}
          </h1>

          <p className="mt-3 text-white/50 text-lg">
            Informe Colectivo del Rival
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
<div className="mb-8 grid gap-4 md:grid-cols-5">

  <div className="
rounded-3xl
border
border-white/5
bg-[#111827]
p-5
shadow-lg
transition-all
duration-300
hover:border-[#C8A96B]/40
hover:-translate-y-1
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

  <div className="rounded-2xl border border-white/10 bg-[#111827] p-4">
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

  <div className="rounded-2xl border border-white/10 bg-[#111827] p-4">
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
<div className="flex justify-end gap-4 mb-6">

 {modoEdicion && (

  <button
    disabled={guardando}
    onClick={guardarRival}
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
<div className="grid gap-8 md:grid-cols-2">

  <section
className="
rounded-3xl
border
border-cyan-500/20
bg-gradient-to-br
from-cyan-500/10
to-[#111827]
p-6
shadow-lg
"
>

  <h2 className="text-xl font-semibold text-cyan-400">
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

 <section className="rounded-3xl border border-blue-500/20
bg-gradient-to-br
from-blue-500/10
to-[#111827] p-6">

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
 <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">

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

    <p className="mt-4 text-white/60 whitespace-pre-wrap">
      {rivalActivo?.ATAQUE}
    </p>

  )}

</section>

  <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">

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

    <p className="mt-4 text-white/60 whitespace-pre-wrap">
      {rivalActivo?.DEFENSA}
    </p>

  )}

</section>

 <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">

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

    <p className="mt-4 text-white/60 whitespace-pre-wrap">
      {rivalActivo?.TRANSICION_OF}
    </p>

  )}

</section>

  <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">

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

    <p className="mt-4 text-white/60 whitespace-pre-wrap">
      {rivalActivo?.TRANSICION_DEF}
    </p>

  )}

</section>

 <section className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6">

  <h2 className="text-xl font-semibold text-cyan-400">
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

  <section className="rounded-3xl border border-blue-500/20 bg-blue-500/5 p-6">

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

  <section className="rounded-3xl border border-violet-500/20 bg-violet-500/5 p-6">

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

  <section className="rounded-3xl border border-violet-500/20 bg-violet-500/5 p-6">

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

  <section className="rounded-3xl border border-green-500/20
bg-gradient-to-br
from-green-500/10
to-[#111827] p-6">

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

 <section className="rounded-3xl border border-red-500/20
bg-gradient-to-br
from-red-500/10
to-[#111827] p-6">

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

<section className="mt-6 rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6">
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

<section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
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

<div className="mt-6 rounded-3xl border border-[#C8A96B]/20
bg-gradient-to-br
from-[#C8A96B]/10
to-[#111827] p-6">

  <h2 className="text-xl font-semibold text-[#C8A96B] mb-6">
    Recursos
  </h2>

  <div className="space-y-6">

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

  </div>

</div>
          
        </div>
      </main>
    </div>
  );
}