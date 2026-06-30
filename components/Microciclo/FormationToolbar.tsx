"use client";

import { useMicroLineup } from "@/context/MicroLineupContext";
import { saveLineup } from "@/lib/saveLineup";
import { usePlayers } from "@/hooks/usePlayers";
import { toPng } from "html-to-image";
import { useState } from "react";
import {
  Save,
  RotateCcw,
  Share2,
  Download,
  LayoutGrid,
} from "lucide-react";

const formations = [
  "4-4-2",
  "4-3-3",
  "4-2-3-1",
  "3-5-2",
  "3-4-3",
];


export default function FormationToolbar() {
  const [showSaveModal, setShowSaveModal] = useState(false);

const [nombre, setNombre] = useState("Jornada ");

const [rival, setRival] = useState("");
  const {
  formation,
  lineup,
  setFormation,
  clearLineup,
} = useMicroLineup();

const { players } = usePlayers();
async function guardar() {

  const nombreLimpio = nombre.trim();

  const valido = /^Jornada\s+\d+$/i.test(nombreLimpio);

  if (!valido) {
    alert(
      "El nombre debe tener el formato 'Jornada X'."
    );
    return;
  }

  await saveLineup({

    nombre: nombreLimpio,

    rival,

    fecha: new Date().toLocaleDateString(),

    sistema: formation,

    alineacion: lineup.map(slot => ({
  positionId: slot.positionId,

  playerIds: slot.playerIds,

  jugadores: slot.playerIds.map(
    id => players.find(p => p.id === id)?.nombre ?? ""
  )
})),

    observaciones: ""

  });

  setShowSaveModal(false);

  setNombre("Jornada ");

  setRival("");

  alert("Alineación guardada.");
}
async function exportPitch() {
  const node = document.getElementById("football-pitch");

  if (!node) return;

  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
  });

  const link = document.createElement("a");

  link.download = "alineacion.png";
  link.href = dataUrl;
  link.click();
}
async function sharePitch() {
  const node = document.getElementById("football-pitch");

  if (!node) return;

  try {
    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
    });

    const blob = await (await fetch(dataUrl)).blob();

    const file = new File(
      [blob],
      "alineacion.png",
      {
        type: "image/png",
      }
    );

    if (
      navigator.share &&
      navigator.canShare?.({ files: [file] })
    ) {
      await navigator.share({
        title: "Alineación RMCF Castilla",
        text: "Alineación creada con la Pizarra RMCF Castilla",
        files: [file],
      });
    } else {
      window.open(dataUrl, "_blank");
    }
  } catch (err) {
    console.error(err);
  }
}
  return (
    <div
  className="
    rounded-3xl
    border
    border-[#C8A96B]/20
    bg-[#121820]
    p-3
    shadow-xl
  "
>
      {/* FORMACIONES */}

   <div
  className="
    flex
    items-center
    gap-3

    overflow-x-auto
    scrollbar-none
    scroll-smooth

    whitespace-nowrap

    pb-2
  "
>

  {/* FORMACIONES */}

  {formations.map((item) => (
    <button
      key={item}
      onClick={() => setFormation(item)}
      className={`
        shrink-0
        rounded-2xl
        border
        px-5
        py-3
        text-sm
        font-semibold
        transition-all
        duration-300

        ${
          formation === item
            ? "border-[#C8A96B] bg-[#C8A96B] text-[#111] shadow-[0_0_20px_rgba(200,169,107,.35)]"
            : "border-white/10 bg-[#1A222C] text-white hover:border-[#C8A96B]/60 hover:bg-[#232D39]"
        }
      `}
    >
      {item}
    </button>
  ))}

  {/* Separador */}

  <div className="mx-1 h-8 w-px shrink-0 bg-white/10" />

  {/* BOTONES */}
<div
  className="
    flex
    items-center
    gap-3
    shrink-0

    lg:ml-auto
  "
>
  <button
    onClick={clearLineup}
    className="shrink-0 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#1A222C] px-5 py-3 text-sm text-white hover:border-[#C8A96B]/50 hover:bg-[#232D39]"
  >
    <RotateCcw size={16} />
    Reset
  </button>

  <button
    onClick={() => setShowSaveModal(true)}
    className="shrink-0 flex items-center gap-2 rounded-2xl border border-[#C8A96B] bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-[#111] hover:brightness-110"
  >
    <Save size={16} />
    Guardar
  </button>

  <button
    onClick={exportPitch}
    className="shrink-0 flex items-center gap-2 rounded-2xl border border-[#C8A96B] bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-[#111] hover:brightness-110"
  >
    <Download size={16} />
    Exportar
  </button>

  <button
    onClick={sharePitch}
    className="shrink-0 flex items-center gap-2 rounded-2xl border border-[#C8A96B] bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-[#111] hover:brightness-110"
  >
    <Share2 size={16} />
    Compartir
  </button>

  <button
    className="shrink-0 flex items-center gap-2 rounded-2xl border border-[#C8A96B] bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-[#111] hover:brightness-110"
  >
    <LayoutGrid size={16} />
    Plantillas
  </button>
</div>
</div>
     {showSaveModal && (

<div
  onClick={() => {
    setShowSaveModal(false);
    setNombre("Jornada ");
    setRival("");
  }}
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
>

<div
  onClick={(e) => e.stopPropagation()}
  className="w-full max-w-md rounded-3xl border border-[#C8A96B]/20 bg-[#151B23] p-6 shadow-2xl"
>
<h2 className="mb-5 text-xl font-semibold">
Guardar alineación
</h2>

<label className="mb-2 block text-sm text-white/70">
Nombre
</label>

<input
value={nombre}
onChange={(e)=>setNombre(e.target.value)}
className="
mb-4
w-full
rounded-xl
border
border-white/10
bg-[#1A222C]
p-3
outline-none
focus:border-[#C8A96B]
"
/>

<label className="mb-2 block text-sm text-white/70">
Rival
</label>

<input
value={rival}
onChange={(e)=>setRival(e.target.value)}
className="
w-full
rounded-xl
border
border-white/10
bg-[#1A222C]
p-3
outline-none
focus:border-[#C8A96B]
"
/>

<p className="mt-4 rounded-xl border border-[#C8A96B]/20 bg-[#C8A96B]/10 p-3 text-xs leading-5 text-[#C8A96B]">

⚠️ Para que esta alineación aparezca en la pizarra de competición debe guardarse con el formato:

<strong className="block mt-1">
Jornada X
</strong>

Ejemplo:

<strong>
Jornada 1
</strong>

</p>

<div className="mt-6 flex justify-end gap-3">

<button

onClick={()=>{
setShowSaveModal(false);
setNombre("Jornada ");
setRival("");
}}

className="
rounded-xl
border
border-white/10
px-4
py-2
hover:bg-white/5
"

>

Cancelar

</button>

<button

onClick={guardar}

className="
rounded-xl
bg-[#C8A96B]
px-5
py-2
font-semibold
text-[#111]
hover:brightness-110
"

>

Guardar

</button>

</div>

</div>

</div>

)}
    </div>
  );
}