"use client";

import { useLineup } from "@/context/LineupContext";
import { saveLineup } from "@/lib/saveLineup";
import { usePlayers } from "@/hooks/usePlayers";
import { capturaNodo } from "@/lib/export/captura";
import { descargaDataUrl } from "@/lib/export/lienzos";
import { useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  RotateCcw,
  Share2,
  Download,
} from "lucide-react";
import { ALINEACIONES_CAMBIADAS } from "@/components/pizarra/SavedLineups";

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

/*
| Guardando (19/10/2026). El botón no se apagaba mientras la hoja contestaba
| —el Apps Script tarda hasta un minuto en frío— y un segundo clic daba de
| alta una segunda fila con la misma jornada. Los avisos van por `toast`, no
| por `alert`, que paraba la página entera.
*/
const [guardando, setGuardando] = useState(false);

const cierraModal = () => {
  if (guardando) return;

  setShowSaveModal(false);
  setNombre("Jornada ");
  setRival("");
};

/** Vaciar el campo pregunta antes si hay alguien colocado. */
const vaciaCampo = () => {
  const colocados = lineup.filter((slot) => slot.playerId).length;

  if (
    colocados > 0 &&
    !window.confirm(
      `¿Quitar a los ${colocados} jugadores del campo? El banquillo se queda como está.`
    )
  ) {
    return;
  }

  clearLineup();
};

async function guardar() {
  if (guardando) return;

  const nombreLimpio = nombre.trim();

  const valido = /^Jornada\s+\d+$/i.test(nombreLimpio);

  if (!valido) {
    toast.error("El nombre tiene que ser «Jornada» y el número", {
      description: "Por ejemplo: Jornada 9.",
    });
    return;
  }

  setGuardando(true);

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
  setGuardando(false);

  if (!resultado?.success) {
    toast.error("No se ha podido guardar la alineación", {
      description:
        resultado?.error ?? "Revisa la conexión e inténtalo de nuevo.",
    });

    return;
  }

  setShowSaveModal(false);

  /* La lista de «Alineaciones guardadas» sólo se leía al abrir la página: la
     jornada recién guardada no salía hasta recargar. */
  window.dispatchEvent(new Event(ALINEACIONES_CAMBIADAS));

  toast.success(
    loadedLineupId ? "Alineación actualizada" : "Alineación guardada",
    { description: nombreLimpio }
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

  /* `capturaNodo` y no `toPng`: en Safari la primera pasada sale sin las
     caras, y en un iPad hay tope de lienzo.

     En un `finally` (19/10/2026): si la captura fallaba, la copia del campo
     se quedaba pegada al final de la página y el campo de verdad, en modo
     exportación. */
  try {
    const { dataUrl } = await capturaNodo(wrapper, {
      cacheBust: true,
      pixelRatio: 2,
    });

    return dataUrl;
  } finally {
    wrapper.remove();

    node.classList.remove("export-mode");
  }
}

async function exportPitch() {
  try {
    const dataUrl = await generateImage();

    if (!dataUrl) return;

    await descargaDataUrl(dataUrl, "alineacion.png");
  } catch (err) {
    console.error(err);
    toast.error("No se ha podido sacar la imagen de la alineación");
  }
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
      /* Sin «compartir» en el navegador (el de un ordenador, casi siempre)
         se descarga. Antes abría la imagen en otra pestaña, y los
         navegadores bloquean abrir una imagen así: no pasaba nada. */
      await descargaDataUrl(dataUrl, "alineacion.png");
      toast.success("Imagen descargada", {
        description: "Este navegador no permite compartir directamente.",
      });
    }
  } catch (err) {
    /* Cerrar el menú de compartir sin elegir no es un fallo. */
    if (err instanceof DOMException && err.name === "AbortError") return;

    console.error(err);
    toast.error("No se ha podido compartir la alineación");
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
  {/* «Vaciar campo» y no «Reset» (19/10/2026), y pregunta antes: de un clic
      se iba la alineación entera, sin deshacer. */}
  <button
    type="button"
    onClick={vaciaCampo}
    title="Quita a todos los jugadores del campo (el banquillo no se toca)"
    className="shrink-0 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#1A222C] px-5 py-3 text-sm text-white hover:border-[#C8A96B]/50 hover:bg-[#232D39]"
  >
    <RotateCcw size={16} />
    Vaciar campo
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
    type="button"
    onClick={exportPitch}
    title="Descarga una imagen PNG de la alineación"
    className="shrink-0 flex items-center gap-2 rounded-2xl border border-[#C8A96B] bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-[#111] hover:brightness-110"
  >
    <Download size={16} />
    Exportar
  </button>

  <button
    type="button"
    onClick={sharePitch}
    title="Manda la imagen de la alineación (en el móvil abre WhatsApp, correo…)"
    className="shrink-0 flex items-center gap-2 rounded-2xl border border-[#C8A96B] bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-[#111] hover:brightness-110"
  >
    <Share2 size={16} />
    Compartir
  </button>

  {/* Aquí había un botón «Plantillas» sin nada detrás: se pulsaba y no
      pasaba nada. Quitado el 19/10/2026. */}
</div>
</div>
     {showSaveModal && (

<div
  onClick={cierraModal}
  onKeyDown={(e) => {
    if (e.key === "Escape") cierraModal();
  }}
  role="dialog"
  aria-modal="true"
  className="modal-veil fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
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
autoFocus
value={nombre}
onChange={(e)=>setNombre(e.target.value)}
onKeyDown={(e) => {
  if (e.key === "Enter") void guardar();
}}
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
onKeyDown={(e) => {
  if (e.key === "Enter") void guardar();
}}
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
type="button"
onClick={cierraModal}
disabled={guardando}
className="
rounded-xl
border
border-white/10
px-4
py-2
hover:bg-white/5
disabled:opacity-40
"
>
Cancelar
</button>

<button
type="button"
onClick={() => void guardar()}
disabled={guardando}
className="
inline-flex
items-center
gap-2
rounded-xl
bg-[#C8A96B]
px-5
py-2
font-semibold
text-[#111]
hover:brightness-110
disabled:cursor-wait
disabled:opacity-60
"
>
{guardando && <Loader2 size={15} className="animate-spin" />}
{guardando ? "Guardando…" : "Guardar"}
</button>

</div>

</div>

</div>

)}
    </div>
  );
}