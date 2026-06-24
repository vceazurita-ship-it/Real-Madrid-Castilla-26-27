"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

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
  fetch(`${API}?action=cultura`)
    .then((r) => r.json())
    .then((rows) => {
      let parsed: CulturaItem[] = [];

      if (Array.isArray(rows)) {
        parsed = rows;
      } else if (
        rows &&
        Array.isArray(rows.data)
      ) {
        parsed = rows.data;
      }

      setData(parsed);
setOriginalData(
  JSON.parse(JSON.stringify(parsed))
);

      if (parsed.length > 0) {
  setSeccion(parsed[0].SECCION);
}
    })
    .catch((err) => {
      console.error(err);
      setData([]);
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
          `${API}?action=guardarCultura&ID=${p.ID}&&CONTENIDO=${encodeURIComponent(
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

      <div className="flex-1">
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
            

            <div className="space-y-2">
  {secciones.map((s) => (
    <button
      key={s}
      onClick={() =>
        setSeccion(s)
      }
      className={`w-full rounded-xl p-3 text-left ${
        seccion === s
          ? "bg-[#C8A96B] text-black"
          : "border border-white/10 text-white"
      }`}
    >
      {s}
    </button>
  ))}
</div>

            
          </div>

          {/* CONTENIDO */}

          <div className="flex-1 p-4 lg:p-8">
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
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
                  CULTURA
                </p>

                <h1
  className="
  text-2xl
  lg:text-3xl
  font-semibold
  text-white
  "
>
                  {seccion}
                </h1>
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
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="
flex
h-7
w-7
lg:h-8
lg:w-8
items-center
justify-center rounded-full bg-[#C8A96B] text-sm font-bold text-black">
                      {p.ORDEN}
                    </div>

                    <div className="flex-1">
                     {editing ? (
  <div className="space-y-3">
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
  <h3 className="text-lg font-semibold text-white">
    {p.TITULO}
  </h3>

  {p.TIPO && (
    <span className="mt-2 inline-flex rounded-full bg-[#C8A96B]/20 px-3 py-1 text-xs text-[#C8A96B]">
      {p.TIPO}
    </span>
  )}
</div>

<p className="text-gray-300 leading-relaxed">
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