"use client";

import { useLineup } from "@/context/LineupContext";
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
  loadedLineupId,
  loadedLineupName,
} = useLineup();

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

  const resultado = await saveLineup({

  id: loadedLineupId?.toString(),

  nombre: nombreLimpio,

  rival,

  fecha: new Date().toLocaleDateString(),

  sistema: formation,

  alineacion: lineup.map(slot => ({

    positionId: slot.positionId,

    playerId: slot.playerId,

    jugador:
      players.find(
        p => p.id === slot.playerId
      )?.nombre || ""

  })),

  observaciones: ""

});

  /* Si no ha entrado, el modal se queda abierto con el nombre puesto para
     poder reintentar sin volver a montar la alineación. */
  if (!resultado?.success) {
    alert(
      `No se ha podido guardar la alineación.\n\n${
        resultado?.error ?? "Revisa la conexión e inténtalo de nuevo."
      }`
    );

    return;
  }

  setShowSaveModal(false);

alert(
  loadedLineupId
    ? "Alineación actualizada."
    : "Alineación guardada."
);
}

async function generateImage() {
  const node = document.getElementById("football-pitch");

  if (!node) return null;

  node.classList.add("export-mode");

  // Clon del campo
  const clone = node.cloneNode(true) as HTMLElement;

  clone.style.width = "100%";
clone.style.height = "700px";      // <- importante
clone.style.minHeight = "700px";
clone.style.position = "relative";
clone.style.flex = "none";
clone.style.overflow = "hidden";

  // Wrapper
  const wrapper = document.createElement("div");

  wrapper.style.background = "#10151C";
  wrapper.style.width = "1200px";
  wrapper.style.padding = "36px";
  wrapper.style.boxSizing = "border-box";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";

  // ==========================
  // CABECERA
  // ==========================

  const header = document.createElement("div");

  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.marginBottom = "28px";

  // Lado izquierdo
  const left = document.createElement("div");

  left.style.display = "flex";
  left.style.alignItems = "center";
  left.style.gap = "24px";

  // Escudo
  const logo = document.createElement("img");

  logo.src = "/images/logo.png";
  logo.style.width = "72px";
  logo.style.height = "72px";
  logo.style.objectFit = "contain";

  // Textos
  const texts = document.createElement("div");

  const title = document.createElement("div");

  title.textContent = "Alineación";
  title.style.color = "#FFFFFF";
  title.style.fontSize = "58px";
  title.style.fontWeight = "700";
  title.style.fontFamily = "Arial, sans-serif";
  title.style.lineHeight = "1";

  const subtitle = document.createElement("div");

  subtitle.textContent = "Real Madrid Castilla";
  subtitle.style.color = "#C8A96B";
  subtitle.style.fontSize = "28px";
  subtitle.style.marginTop = "12px";
  subtitle.style.fontFamily = "Arial, sans-serif";

  texts.appendChild(title);
  texts.appendChild(subtitle);

  left.appendChild(logo);
  left.appendChild(texts);

  header.appendChild(left);

  // Línea inferior
  const divider = document.createElement("div");

  divider.style.height = "2px";
  divider.style.background = "#2A2F36";
  divider.style.marginBottom = "28px";

  // ==========================

  wrapper.appendChild(header);
  wrapper.appendChild(divider);
  wrapper.appendChild(clone);

  document.body.appendChild(wrapper);

  const dataUrl = await toPng(wrapper, {
    cacheBust: true,
    pixelRatio: 2,
  });

  document.body.removeChild(wrapper);

  node.classList.remove("export-mode");

  return dataUrl;
}

async function exportPitch() {
  const dataUrl = await generateImage();

  if (!dataUrl) return;

  const link = document.createElement("a");

  link.download = "alineacion.png";
  link.href = dataUrl;
  link.click();
}
async function sharePitch() {
  try {
    const dataUrl = await generateImage();

    if (!dataUrl) return;

    const blob = await (await fetch(dataUrl)).blob();

    const file = new File([blob], "alineacion.png", {
      type: "image/png",
    });

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
    onClick={() => {
  if (loadedLineupId) {
    setNombre(loadedLineupName ?? "");
  } else {
    setNombre("Jornada "); // Microciclo en la otra pizarra
    setRival("");
  }

  setShowSaveModal(true);
}}
    className="shrink-0 flex items-center gap-2 rounded-2xl border border-[#C8A96B] bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-[#111] hover:brightness-110"
  >
    <Save size={16} />
{loadedLineupId ? "Actualizar" : "Guardar"}
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
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
>

<div
  onClick={(e) => e.stopPropagation()}
  className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-[#C8A96B]/20 bg-[#151B23] p-6 shadow-2xl"
>
<h2 className="mb-5 text-xl font-semibold">
{loadedLineupId
  ? "Actualizar alineación"
  : "Guardar alineación"}
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