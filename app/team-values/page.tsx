"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import Papa from "papaparse";

type CulturaItem = {
  ID: number;
  SECCION: string;
  TIPO: string;
  TITULO: string;
  CONTENIDO: string;
  ORDEN: number;
  OBSERVACIONES?: string;
};

const API =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

export default function GameModelPage() {
  const [data, setData] =
  useState<CulturaItem[]>([]);

const [originalData, setOriginalData] =
  useState<CulturaItem[]>([]);

const [seccion, setSeccion] =
  useState("");

  const [editing, setEditing] =
    useState(false);

 useEffect(() => {

  fetch(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1367356753&single=true&output=csv"
  )
    .then((r) => r.text())
    .then((csv) => {

      const parsed =
        Papa.parse<CulturaItem>(
          csv,
          {
            header: true,
            skipEmptyLines: true,
          }
        );

      const rows =
        parsed.data;

      setData(rows);

      setOriginalData(
        structuredClone(rows)
      );

      if (rows.length > 0) {
        setSeccion(
          rows[0].SECCION
        );
      }
    });

}, []);
const secciones = useMemo(() => {
  return [
    ...new Set(
      data.map((r) => r.SECCION)
    ),
  ];
}, [data]);

const contenidos = useMemo(() => {
  return data
    .filter(
      (r) =>
        r.SECCION === seccion
    )
    .sort(
      (a, b) =>
        Number(a.ORDEN) -
        Number(b.ORDEN)
    );
}, [data, seccion]);
const guardarCambios = async () => {
  try {

    const cambios = data.filter((item) => {
      const original = originalData.find(
        (o) => o.ID === item.ID
      );

      return (
        original?.CONTENIDO !== item.CONTENIDO ||
        (original?.OBSERVACIONES || "") !==
          (item.OBSERVACIONES || "")
      );
    });

    if (cambios.length === 0) {
      setEditing(false);
      return;
    }

    await Promise.all(
      cambios.map((p) =>
        fetch(
          `${API}?action=guardarCultura&ID=${p.ID}&CONTENIDO=${encodeURIComponent(
            p.CONTENIDO
          )}&OBSERVACIONES=${encodeURIComponent(
            p.OBSERVACIONES || ""
          )}`
        )
      )
    );

    setOriginalData(
      structuredClone(data)
    );

    setEditing(false);

  } catch (err) {
    console.error(
      "Error guardando:",
      err
    );
  }
};
  return (
    <div className="flex min-h-screen bg-[#0B0F14]">
      <Sidebar />

      <div className="flex-1 min-w-0">
        <Topbar />

        <div className="flex flex-col lg:flex-row">
          {/* MENÚ IZQUIERDO */}

          <div
  className="
  w-full
  lg:w-[300px]
  xl:w-[340px]
  lg:border-r
  border-white/10
  p-4useState
  lg:p-6
  "
>
            

           <div
  className="
  flex
  gap-2
  overflow-x-auto
  pb-2
  lg:block
  lg:space-y-2
  "
>
  {secciones.map((s) => {

  const total =
    data.filter(
      (item) =>
        item.SECCION === s
    ).length;

  return (
    <button
      key={s}
      onClick={() =>
        setSeccion(s)
      }
      className={`
shrink-0
min-w-[120px]
lg:w-full
rounded-xl
p-3
text-left ${
        seccion === s
          ? "bg-[#C8A96B] text-black"
          : "border border-white/10 text-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <span>{s}</span>
        <span className="text-xs opacity-70">
          {total}
        </span>
      </div>
    </button>
  );
})}
</div>

            
          </div>

          {/* CONTENIDO */}

          <div className="flex-1 p-4 lg:p-8">
            <div
  className="
rounded-2xl lg:rounded-3xl
border
border-white/10
bg-gradient-to-br
from-white/[0.05]
to-white/[0.02]
p-6
transition-all
hover:border-[#C8A96B]/30
"
>

  <p
    className="
    text-xs
    uppercase
    tracking-[0.3em]
    text-[#C8A96B]
    "
  >
    ROADMAP CULTURAL
  </p>

<div
  className="
  mt-4
  flex
  items-center
  overflow-x-auto
  pb-2
  scrollbar-hide
  "
>
    {secciones.map((s, i) => (

      <div
        key={s}
        className="
        flex
        items-center
        shrink-0
        "
      >

        <button
  onClick={() =>
    setSeccion(s)
  }
  className={`
    flex
    h-8
    w-8
    lg:h-10
    lg:w-10
    items-center
    justify-center
    rounded-full
    text-xs
    lg:text-sm
    font-bold
    transition-all
    ${
      s === seccion
        ? "bg-[#C8A96B] text-black"
        : "bg-white/10 text-white hover:bg-white/20"
    }
  `}
>
  {i + 1}
</button>

        {i <
          secciones.length - 1 && (
          <div
            className="
            h-[2px]
            w-6 lg:w-10
            bg-white/10
            "
          />
        )}

      </div>

    ))}
  </div>
</div>
<div className="mt-5">

  <p
    className="
    text-sm
    uppercase
    tracking-wider
    text-[#C8A96B]
    "
  >
    {seccion}
  </p>

</div>
            <div
  className="
  mb-8
  flex
  flex-col
  gap-4
  lg:flex-row
  lg:items-center
  lg:justify-between
  "
>
<h1
className="
text-2xl
sm:text-4xl
lg:text-5xl
font-bold
text-white
leading-none
"
>
    {seccion}
  </h1>
<p
className="
mt-2
max-w-2xl
text-sm
lg:text-base
text-gray-400
"
>
  {
    seccion === "MARCO"
      ? "Fundamentos conceptuales sobre identidad, propósito y cultura."

      : seccion === "PLANIFICACION"
      ? "Diseño del proceso y estructura de implementación."

      : seccion === "SEMANA 1"
      ? "Construcción del significado de pertenecer al grupo."

      : seccion === "SEMANA 2"
      ? "Definición de valores y comportamientos observables."

      : seccion === "SEMANA 3"
      ? "Establecimiento de estándares e innegociables."

      : seccion === "SEMANA 4"
      ? "Consolidación de hábitos y herramientas culturales."

      : ""
  }
</p>
  <p
    className="
    mt-2
    max-w-2xl
    text-gray-400
    "
  >
    Construcción de identidad,
    valores, hábitos y estándares
    del vestuario.
  </p>

</div>

             <div className="flex w-full gap-3 lg:w-auto">
  {editing && (
    <button
  type="button"
  onClick={guardarCambios}
  className="
    rounded-xl
    bg-[#C8A96B]
    flex-1 lg:flex-none px-4 py-3
    font-medium
    text-black
  "
>
  Guardar
</button>
  )}

  <button
  onClick={() => {
    if (editing) {
      setData(
        JSON.parse(
          JSON.stringify(originalData)
        )
      );
    }

    setEditing(!editing);
  }}
    className="
    rounded-xl
    border
    border-[#C8A96B]
    flex-1 lg:flex-none px-4 py-3
    text-[#C8A96B]
    "
  >
    {editing
      ? "Cancelar"
      : "Editar"}
  </button>
</div>
            </div>

            <div className="space-y-3">
              {contenidos.map((p) => (
                <div
                  key={p.ID}
                  className="
group
rounded-3xl
border
border-white/10
bg-gradient-to-br
from-white/[0.05]
to-white/[0.02]
p-4 lg:p-6
transition-all
hover:-translate-y-1
hover:border-[#C8A96B]/40
hover:bg-white/[0.05]
"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div
  className="
  flex
  h-8
w-8
lg:h-12
lg:w-12
  items-center
  justify-center
  rounded-2xl
  bg-[#C8A96B]
  text-xs
lg:text-lg
font-bold
  text-black
  "
>
                      {p.ORDEN}
                    </div>

                    <div className="flex-1 min-w-0">
                     {editing ? (
  <div className="space-y-6">

    <h3
  className="
  text-base
  lg:text-lg
  font-semibold
  text-white
  break-words
  "
>
      {p.TITULO}
    </h3>
    <textarea
      value={p.CONTENIDO}
      onChange={(e) => {
        setData((prev) =>
          prev.map((item) =>
            item.ID === p.ID
              ? {
                  ...item,
                  CONTENIDO:
                    e.target.value,
                }
              : item
          )
        );
      }}
      className="
      w-full
      rounded-xl
      border
      border-white/10
      bg-black/30
      p-3
      text-white
      outline-none
      "
      rows={3}
    />

    <textarea
      value={
        p.OBSERVACIONES || ""
      }
      onChange={(e) => {
        setData((prev) =>
          prev.map((item) =>
            item.ID === p.ID
              ? {
                  ...item,
                  OBSERVACIONES:
                    e.target.value,
                }
              : item
          )
        );
      }}
      className="
      w-full
      rounded-xl
      border
      border-white/10
      bg-black/30
      p-3
      text-sm
      text-gray-300
      outline-none
      "
      rows={2}
      placeholder="Observaciones..."
    />
  </div>
) : (
  <>
   <div className="mb-3">
  <h3
  className="
  text-base
  lg:text-lg
  font-semibold
  text-white
  break-words
  "
>
    {p.TITULO}
  </h3>

  {p.TIPO && (
    <span
  className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${
    p.TIPO === "VALOR"
      ? "bg-green-500/20 text-green-400"
      : p.TIPO === "ANTIVALOR"
      ? "bg-red-500/20 text-red-400"
      : p.TIPO === "INNEGOCIABLE"
      ? "bg-blue-500/20 text-blue-400"
      : p.TIPO === "INTOLERABLE"
      ? "bg-orange-500/20 text-orange-400"
      : "bg-[#C8A96B]/20 text-[#C8A96B]"
  }`}
>
  {p.TIPO}
</span>
  )}
</div>

<p
  className="
  text-sm
  lg:text-base
  text-gray-300
  leading-relaxed
  break-words
  "
>
  {p.CONTENIDO}
</p>

    {p.OBSERVACIONES && (
      <p className="mt-2 text-sm text-gray-400">
        {p.OBSERVACIONES}
      </p>
    )}
  </>
)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>  
  );
}