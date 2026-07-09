"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ScoutRivalCollective() {
  const [rivales, setRivales] = useState<any[]>([]);
  const [rivalActivo, setRivalActivo] = useState<any>(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const guardarRival = async () => {
    if (!rivalActivo) return;

    setGuardando(true);

    try {
      const body = new URLSearchParams();

      body.append("action", "guardarRival");

      Object.entries(rivalActivo).forEach(([key, value]) => {
        body.append(key, String(value ?? ""));
      });
console.log(rivalActivo);
      const res = await fetch(
        "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec",
        {
          method: "POST",
          body,
        }
      );

     const data = await res.json();

console.log(data);

if (data.success) {
  alert("Informe guardado correctamente");
  setModoEdicion(false);
} else {
  alert(JSON.stringify(data, null, 2));
}
    } finally {
      setGuardando(false);
    }
  };

  useEffect(() => {
    console.log(rivalActivo);
    fetch(
      "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec?action=rivales"
    )
      .then((r) => r.json())
      .then((data) => {
        setRivales(data);

        if (data.length) {
          setRivalActivo(data[0]);
        }
      });
  }, []);

  const ayudasCampos: Record<string, string[]> = {
  OF_REINICIO_ROMBO: ["Situaciones en rombo"],
  OF_REINICIO_REFERENCIA_PARTIDO: ["Referencia partido ida"],
  OF_REINICIO_REFERENCIAS: ["Referencias determinantes"],
  OF_REINICIO_EQUIPO_PRESIONANTE: ["Equipo presionante"],
  OF_REINICIO_CONTEXTO: ["Contextualización"],
  OF_REINICIO_CERRADO: ["Cerrado"],

  OF_INICIO_ESTRUCTURA: ["Estructura"],
  OF_INICIO_CENTRAL_CAPACIDAD: ["Central con mayor y menor capacidad"],
  OF_INICIO_JUGAR_ESPACIO: ["Capacidad para jugar al espacio"],
  OF_INICIO_JUGADOR_DEBIL_DENTRO: ["Jugador débil por dentro"],
  OF_INICIO_ASOCIACIONES: ["Capacidad para asociarse por dentro"],

  OF_CAMPO_ESTRUCTURA: ["Estructura general"],
  OF_CAMPO_CARRIL_EXTERIOR: ["Carril exterior"],
  OF_CAMPO_JUGADORES_DENTRO: ["Jugadores por dentro"],
  OF_AREA_JUGADORES: ["Jugadores que atacan el área"],
  OF_AREA_CENTROS: ["Tipos de centros"],

  TRANSICION_DEF_ESTRUCTURA: ["Estructura compensadora"],
  TRANSICION_DEF_DIFICULTADES_ESPALDA: ["Dificultades espalda"],
  TRANSICION_DEF_PRIMERA_INTENCION: ["Primera intención tras pérdida"],

  DEF_REINICIO_EMPAREJAN: ["Emparejamientos"],
  DEF_REINICIO_ORIENTAN: ["Orientaciones"],
  DEF_REINICIO_ACTIVOS_PRESION: ["Activos en presión"],
  DEF_REINICIO_JUGADORES_DEBILES: ["Jugadores débiles"],

  DEF_BLOQUE_ALTO_ESTRUCTURA: ["Estructura"],
  DEF_BLOQUE_ALTO_TRAYECTORIA_ACOSO: ["Trayectoria de acoso"],
  DEF_BLOQUE_ALTO_SALTOS_PARES_IMPARES: ["Saltos pares/impares"],
  DEF_BLOQUE_ALTO_DISTANCIAS: ["Distancias"],
  DEF_BLOQUE_ALTO_ESPALDA: ["Defensa espalda"],

  DEF_BLOQUE_MEDIO_ESTRUCTURA: ["Estructura"],
  DEF_BLOQUE_MEDIO_FUSIONAN_LINEA: ["Fusionan línea"],
  DEF_BLOQUE_MEDIO_CORTES: ["Quién defiende cortes"],
  DEF_BLOQUE_MEDIO_DISTANCIAS: ["Distancias"],
  DEF_BLOQUE_MEDIO_CENTRALES_SALTADORES: ["Centrales saltadores"],
  DEF_BLOQUE_MEDIO_ESPALDA: ["Defensa espalda"],

  DEF_AREA_HUNDE_LINEA: ["Se hunde la línea"],
  DEF_AREA_PUNTO_PENALTI: ["Defensa punto penalti"],
  DEF_AREA_JUGADOR_DEBIL: ["Jugador débil"],

  FORTALEZAS_INDIVIDUALES: ["Fortalezas individuales"],
  DEBILIDADES_INDIVIDUALES: ["Debilidades individuales"],
  JUGADORES_CLAVE: ["Jugadores clave"],
  CLAVES_PARTIDO: ["Claves del partido"],
  PLAN_PARTIDO: ["Plan de partido"],
  CLAVES_EMOCIONALES: ["Claves emocionales"],
  OBSERVACIONES: ["Observaciones"],
  ESTADO_EQUIPO: ["Estado del equipo"],
};

const Campo = ({
  titulo,
  campo,
  className = "",
  rows = 4,
}: {
  titulo: string;
  campo: string;
  className?: string;
  rows?: number;
}) => (
  <div
    className={`
      rounded-xl
      border
      ${
        modoEdicion
          ? "border-amber-400"
          : "border-[#C8A96B]/20"
      }
      bg-[#111827]
      p-4
      min-h-[110px]
      ${className}
    `}
  >
    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#C8A96B]">
      {titulo}
    </p>

    {modoEdicion && (
      <>
        <div className="mb-2 inline-block rounded bg-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-300">
          CSV: {campo}
        </div>

        {ayudasCampos[campo] && (
          <p className="mb-3 text-[11px] text-white/40">
            {ayudasCampos[campo].join(" · ")}
          </p>
        )}
      </>
    )}

    {modoEdicion ? (
      <textarea
        rows={rows}
        value={rivalActivo?.[campo] ?? ""}
        onChange={(e) =>
          setRivalActivo({
            ...rivalActivo,
            [campo]: e.target.value,
          })
        }
        className="w-full rounded-xl border border-amber-400/30 bg-black/40 p-3 text-white outline-none focus:border-amber-400"
      />
    ) : (
      <p className="whitespace-pre-wrap text-sm leading-6 text-white/80">
        {rivalActivo?.[campo] || "-"}
      </p>
    )}
  </div>
);

const TituloBloque = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <div className="col-span-2 rounded-xl bg-[#1f3b6d] py-3 text-center font-bold uppercase">
    {children}
  </div>
);

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="flex-1">
        <Topbar />

        <div className="p-5 md:p-10">

          <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

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

  <div className="flex flex-col gap-3 sm:flex-row">

  <Link
    href="/plan-partido"
    className="
      flex
      items-center
      justify-center
      rounded-2xl
      bg-[#C8A96B]
      px-6
      py-3
      font-semibold
      text-black
      transition
      hover:scale-105
    "
  >
    Plan de Partido
  </Link>

  {modoEdicion && (
    <button
      disabled={guardando}
      onClick={guardarRival}
      className="
        rounded-2xl
        bg-green-600
        px-6
        py-3
        font-semibold
      "
    >
      {guardando ? "Guardando..." : "Guardar"}
    </button>
  )}

  <button
    onClick={() => setModoEdicion(!modoEdicion)}
    className="
      rounded-2xl
      border
      border-[#C8A96B]/40
      px-6
      py-3
      font-semibold
    "
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
    mb-8
    w-full
    rounded-2xl
    border
    border-white/5
    bg-[#111827]
    px-4
    py-4
    text-lg
    font-semibold
    text-white
    shadow-lg
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
<div className="
mt-8
rounded-2xl
border
border-[#C8A96B]/15
bg-[#111827]
p-5
">

  <h2 className="mb-4 text-lg font-bold text-[#C8A96B]">
    Recursos
  </h2>

  <div className="grid gap-5 md:grid-cols-4 xl:grid-cols-5">

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
HUDL Playlist
</p>

{modoEdicion ? (

<input
value={rivalActivo?.HUDL_PLAYLIST || ""}
onChange={(e)=>
setRivalActivo({
...rivalActivo,
HUDL_PLAYLIST:e.target.value
})
}
className="w-full rounded-2xl border border-white/10 bg-[#111827] p-4"
/>

) : (

rivalActivo?.HUDL_PLAYLIST && (

<a
href={rivalActivo.HUDL_PLAYLIST}
target="_blank"
rel="noreferrer"
className="inline-block rounded-2xl border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-6 py-3 font-semibold text-[#C8A96B]"
>

Abrir Playlist

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

<section className="mt-12">

<h2 className="text-3xl font-bold">
Bases de Juego
</h2>

<p className="mt-2 uppercase tracking-widest text-[#C8A96B]">
Situaciones a dominar
</p>

{/* ================= OFENSIVO ================= */}

<div className="mt-8 rounded-xl bg-red-600 py-3 text-center font-bold uppercase">
OFENSIVO
</div>

<div className="mt-8 grid gap-10 xl:grid-cols-2">

{/* ================= IZQUIERDA ================= */}

<div>

<div className="mb-6 rounded-xl bg-orange-200 py-3 text-center font-bold text-black">
REINICIOS OF
</div>

<div className="grid grid-cols-2 gap-4">

<Campo titulo="Situaciones en rombo" campo="OF_REINICIO_ROMBO" />

<Campo titulo="Referencia partido ida" campo="OF_REINICIO_REFERENCIA_PARTIDO" />

<Campo titulo="Referencias determinantes" campo="OF_REINICIO_REFERENCIAS" />

<Campo titulo="Equipo presionante" campo="OF_REINICIO_EQUIPO_PRESIONANTE" />

<Campo titulo="Contextualización" campo="OF_REINICIO_CONTEXTO" />

<Campo titulo="Cerrado" campo="OF_REINICIO_CERRADO" />

</div>

<TituloBloque>
INICIOS - PROGRESIÓN
</TituloBloque>

<div className="mt-4 grid grid-cols-2 gap-4">

<Campo
titulo="Estructura"
campo="OF_INICIO_ESTRUCTURA"
/>

<Campo
titulo="Central con mayor y menor capacidad"
campo="OF_INICIO_CENTRAL_CAPACIDAD"
/>

<Campo
titulo="Capacidad para jugar al espacio"
campo="OF_INICIO_JUGAR_ESPACIO"
/>

<Campo
titulo="Jugador débil por dentro"
campo="OF_INICIO_JUGADOR_DEBIL_DENTRO"
/>

<Campo
titulo="Capacidad para asociarse por dentro"
campo="OF_INICIO_ASOCIACIONES"
className="col-span-2"
/>

</div>

</div>

{/* ================= DERECHA ================= */}

<div>

<TituloBloque>

CAMPO CONTRARIO

</TituloBloque>

<div className="mt-4 grid grid-cols-2 gap-4">

<Campo
titulo="Estructura general"
campo="OF_CAMPO_ESTRUCTURA"
/>

<Campo
titulo="Carril exterior"
campo="OF_CAMPO_CARRIL_EXTERIOR"
/>

<Campo
titulo="Jugadores por dentro"
campo="OF_CAMPO_JUGADORES_DENTRO"
/>

</div>

<div className="grid grid-cols-2 gap-4">

<Campo
titulo="Jugadores que atacan el área"
campo="OF_AREA_JUGADORES"
/>

<Campo
titulo="Tipos de centros"
campo="OF_AREA_CENTROS"
/>

</div>

<div className="mt-8 mb-6 rounded-xl bg-gray-600 py-3 text-center font-bold">

TRANSICIÓN DEFENSIVA

</div>

<div className="grid grid-cols-2 gap-4">

<Campo
titulo="Estructura compensadora"
campo="TRANSICION_DEF_ESTRUCTURA"
/>

<Campo
titulo="Dificultades espalda"
campo="TRANSICION_DEF_DIFICULTADES_ESPALDA"
/>

<Campo
titulo="Primera intención tras pérdida"
campo="TRANSICION_DEF_PRIMERA_INTENCION"
className="col-span-2"
/>

</div>

</div>

</div>

{/* ================= DEFENSIVO ================= */}

<div className="mt-14 rounded-xl bg-blue-900 py-3 text-center font-bold uppercase">

DEFENSIVO

</div>

<div className="mt-8 grid gap-10 xl:grid-cols-2">

{/* IZQUIERDA */}

<div>

<div className="mb-6 rounded-xl bg-blue-300 py-3 text-center font-bold text-black">

REINICIOS DEF

</div>

<div className="grid grid-cols-2 gap-4">

<Campo
titulo="Emparejamientos"
campo="DEF_REINICIO_EMPAREJAN"
/>

<Campo
titulo="Orientaciones"
campo="DEF_REINICIO_ORIENTAN"
/>

<Campo
titulo="Activos en presión"
campo="DEF_REINICIO_ACTIVOS_PRESION"
/>

<Campo
titulo="Jugadores débiles"
campo="DEF_REINICIO_JUGADORES_DEBILES"
/>

</div>

<div className="mt-8 mb-6 rounded-xl bg-blue-400 py-3 text-center font-bold text-black">

BLOQUE ALTO

</div>

<div className="grid grid-cols-2 gap-4">

<Campo
titulo="Estructura"
campo="DEF_BLOQUE_ALTO_ESTRUCTURA"
/>

<Campo
titulo="Trayectoria de acoso"
campo="DEF_BLOQUE_ALTO_TRAYECTORIA_ACOSO"
/>

<Campo
titulo="Saltos pares / impares"
campo="DEF_BLOQUE_ALTO_SALTOS_PARES_IMPARES"
/>

<Campo
titulo="Distancias"
campo="DEF_BLOQUE_ALTO_DISTANCIAS"
/>

<Campo
titulo="Defensa espalda"
campo="DEF_BLOQUE_ALTO_ESPALDA"
className="col-span-2"
/>

</div>

</div>

{/* DERECHA */}

<div>

<div className="mb-6 rounded-xl bg-blue-500 py-3 text-center font-bold">

BLOQUE MEDIO

</div>

<div className="grid grid-cols-2 gap-4">

<Campo
titulo="Estructura"
campo="DEF_BLOQUE_MEDIO_ESTRUCTURA"
/>

<Campo
titulo="Fusionan línea"
campo="DEF_BLOQUE_MEDIO_FUSIONAN_LINEA"
/>

<Campo
titulo="Quién defiende cortes"
campo="DEF_BLOQUE_MEDIO_CORTES"
/>

<Campo
titulo="Distancias"
campo="DEF_BLOQUE_MEDIO_DISTANCIAS"
/>

<Campo
titulo="Centrales saltadores"
campo="DEF_BLOQUE_MEDIO_CENTRALES_SALTADORES"
/>

<Campo
titulo="Defensa espalda"
campo="DEF_BLOQUE_MEDIO_ESPALDA"
/>

</div>

<div className="mt-8 mb-6 rounded-xl bg-blue-700 py-3 text-center font-bold">

DEFENSA DE ÁREA

</div>

<div className="grid grid-cols-2 gap-4">

<Campo
titulo="Se hunde la línea"
campo="DEF_AREA_HUNDE_LINEA"
/>

<Campo
titulo="Defensa punto penalti"
campo="DEF_AREA_PUNTO_PENALTI"
/>

<Campo
titulo="Jugador débil"
campo="DEF_AREA_JUGADOR_DEBIL"
className="col-span-2"
/>

</div>

</div>

</div>

</section>

<div className="mt-10 grid gap-8 lg:grid-cols-2">

  <Campo
    titulo="Jugadores Clave"
    campo="JUGADORES_CLAVE"
    rows={8}
  />

  <Campo
    titulo="Fortalezas Individuales"
    campo="FORTALEZAS_INDIVIDUALES"
    rows={8}
  />

  <Campo
    titulo="Debilidades Individuales"
    campo="DEBILIDADES_INDIVIDUALES"
    rows={8}
  />

  <Campo
    titulo="Estado del Equipo"
    campo="ESTADO_EQUIPO"
    rows={8}
  />

  <Campo
    titulo="Claves del Partido"
    campo="CLAVES_PARTIDO"
    rows={8}
  />

  <Campo
    titulo="Plan de Partido"
    campo="PLAN_PARTIDO"
    rows={8}
  />

  <Campo
    titulo="Claves Emocionales"
    campo="CLAVES_EMOCIONALES"
    rows={8}
  />

  <Campo
    titulo="Observaciones"
    campo="OBSERVACIONES"
    rows={10}
    className="lg:col-span-2"
  />

</div>

        </div>
      </main>
    </div>
  );
}