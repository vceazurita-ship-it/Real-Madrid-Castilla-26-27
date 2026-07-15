"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

type PosicionItem = {
  ID: number;
  POSICION: string;
  BLOQUE: string;
  TITULO: string;
  CONTENIDO: string;
  ORDEN: number;
  OBSERVACIONES?: string;
  ACTIVO?: string;
};

const API =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

export default function IdentidadPosicionalPage() {

  const [data, setData] =
    useState<PosicionItem[]>([]);

  const [originalData, setOriginalData] =
    useState<PosicionItem[]>([]);

  const [posicion, setPosicion] =
    useState("");

  const [editing, setEditing] =
    useState(false);

   const [showNuevo, setShowNuevo] =
  useState(false);

const [nuevo, setNuevo] =
  useState({
    BLOQUE: "CON BALÓN",
    CONTENIDO: "",
    OBSERVACIONES: "",
    ORDEN: "",
  }); 

const cargarDatos = async () => {

  const r = await fetch(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=554039137&single=true&output=csv"
  );

  const csv = await r.text();

  const parsed =
    Papa.parse<PosicionItem>(csv, {
      header: true,
      skipEmptyLines: true,
    });

  const rows =
    parsed.data.filter(
      (r) =>
        String(r.ACTIVO).toUpperCase() !== "FALSE"
    );

  setData(rows);

  setOriginalData(structuredClone(rows));

  if (rows.length > 0) {
    setPosicion((p) => p || rows[0].POSICION);
  }

};

 useEffect(() => {
  cargarDatos();
}, []);

  const posiciones =
    useMemo(() => {

      return [
        ...new Set(
          data.map(
            (r) => r.POSICION
          )
        ),

      ];

    }, [data]);

  const contenidos =
  useMemo(() => {

      return [...data]
        .filter(
          (r) =>
            r.POSICION === posicion
        )
        .sort(
          (a, b) =>
            Number(a.ORDEN) -
            Number(b.ORDEN)
        );

    }, [data, posicion]);

  const conBalon =
    contenidos.filter(
      (c) =>
        c.BLOQUE ===
        "CON BALÓN"
    );

  const sinBalon =
    contenidos.filter(
      (c) =>
        c.BLOQUE ===
        "SIN BALÓN"
    );

  const guardarCambios =
    async () => {

      try {

        const cambios =
          data.filter((item) => {

            const original =
              originalData.find(
                (o) =>
                  o.ID === item.ID
              );

            return (

              original?.CONTENIDO !==
                item.CONTENIDO ||

              (original?.OBSERVACIONES ||
                "") !==
                (item.OBSERVACIONES ||
                  "")

            );

          });

        if (
          cambios.length === 0
        ) {

          setEditing(false);

          return;

        }

        await Promise.all(

          cambios.map((p) =>

            fetch(

              `${API}?action=guardarIdentidadPosicional&ID=${p.ID}&CONTENIDO=${encodeURIComponent(
                p.CONTENIDO
              )}&OBSERVACIONES=${encodeURIComponent(
                p.OBSERVACIONES || ""
              )}`

            )

          )

        );

        setEditing(false);
await cargarDatos();

      } catch (err) {

        console.error(err);

      }

    };

const borrarItem = async (id: number) => {

  if (!confirm("¿Eliminar este contenido?")) return;

  try {

    await fetch(
      `${API}?action=borrarIdentidadPosicional&ID=${id}`
    );

    await cargarDatos();

  } catch (err) {
    console.error(err);
  }

};

const crearItem = async () => {

  if (!nuevo.CONTENIDO.trim()) {
    alert("Introduce un contenido");
    return;
  }

  try {

    await fetch(
      `${API}?action=crearIdentidadPosicional` +
      `&POSICION=${encodeURIComponent(posicion)}` +
      `&BLOQUE=${encodeURIComponent(nuevo.BLOQUE)}` +
      `&CONTENIDO=${encodeURIComponent(nuevo.CONTENIDO)}` +
      `&OBSERVACIONES=${encodeURIComponent(nuevo.OBSERVACIONES)}` +
      `&ORDEN=${encodeURIComponent(nuevo.ORDEN)}`
    );

    // Lo más sencillo: recargar la página
    setShowNuevo(false);

setNuevo({
  BLOQUE: "CON BALÓN",
  CONTENIDO: "",
  OBSERVACIONES: "",
  ORDEN: "",
});

await cargarDatos();

  } catch (err) {
    console.error(err);
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
              lg:w-[280px]
              xl:w-[320px]
              border-r
              border-white/10
              p-4
              lg:p-6
            "
          >

            <h2 className="mb-6 text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              Posiciones
            </h2>

            <div className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2">

              {posiciones.map((p) => {

                const total =
                  data.filter(
                    (x) =>
                      x.POSICION === p
                  ).length;

                return (

                  <button
                    key={p}
                    onClick={() =>
                      setPosicion(p)
                    }
                    className={`
                      shrink-0
                      min-w-[140px]
                      lg:w-full
                      rounded-2xl
                      p-4
                      text-left
                      transition-all
                      ${
                        posicion === p
                          ? "bg-[#C8A96B] text-black"
                          : "border border-white/10 text-white hover:border-[#C8A96B]/30"
                      }
                    `}
                  >

                    <div className="flex items-center justify-between">

                      <span className="font-medium">
                        {p}
                      </span>

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
                rounded-3xl
                border
                border-white/10
                bg-gradient-to-br
                from-white/[0.05]
                to-white/[0.02]
                p-6
                lg:p-10
              "
            >

              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

                <div>

                  <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">

                    CONTENIDOS INDIVIDUALES

                  </p>

                  <h1 className="mt-4 text-4xl lg:text-6xl font-bold text-white">

                    {posicion}

                  </h1>

                  <p className="mt-3 text-gray-400">

                    Foco individual por posición

                  </p>

                </div>

                <div className="flex gap-3">

                  {editing && (

                    <button
                      onClick={guardarCambios}
                      className="
                        rounded-xl
                        bg-[#C8A96B]
                        px-5
                        py-3
                        font-semibold
                        text-black
                      "
                    >

                      Guardar

                    </button>

                  )}
                  {editing && (

  <button
    onClick={() => setShowNuevo(true)}
    className="
      rounded-xl
      bg-green-600
      px-5
      py-3
      font-semibold
      text-white
      hover:bg-green-700
    "
  >
    Añadir
  </button>

)}

                  <button
                    onClick={() => {

                      if (editing) {

                        setData(
                          structuredClone(
                            originalData
                          )
                        );

                      }

                      setEditing(
                        !editing
                      );

                    }}
                    className="
                      rounded-xl
                      border
                      border-[#C8A96B]
                      px-5
                      py-3
                      text-[#C8A96B]
                    "
                  >

                    {editing
                      ? "Cancelar"
                      : "Editar"}

                  </button>

                </div>

              </div>

              <div className="mt-12 grid gap-10 lg:grid-cols-2">

                {/* CON BALÓN */}

                <div>

                  <h2 className="mb-6 text-xl font-bold text-[#C8A96B]">

                    CON BALÓN

                  </h2>

                  <div className="space-y-4">
                                        {conBalon.map((item) => (

                      <div
                        key={item.ID}
                        className="border-b border-white/10 pb-4"
                      >

                        {editing ? (

  <div className="space-y-3">

    <div className="flex justify-end">
      <button
        onClick={() => borrarItem(item.ID)}
        className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
      >
        Eliminar
      </button>
    </div>

    <textarea
                              value={item.CONTENIDO}
                              rows={2}
                              onChange={(e) => {

                                setData((prev) =>
                                  prev.map((x) =>
                                    x.ID === item.ID
                                      ? {
                                          ...x,
                                          CONTENIDO:
                                            e.target.value,
                                        }
                                      : x
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
                            />

                            <textarea
                              value={
                                item.OBSERVACIONES ||
                                ""
                              }
                              rows={2}
                              placeholder="Observaciones..."
                              onChange={(e) => {

                                setData((prev) =>
                                  prev.map((x) =>
                                    x.ID === item.ID
                                      ? {
                                          ...x,
                                          OBSERVACIONES:
                                            e.target.value,
                                        }
                                      : x
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
                            />

                          </div>

                        ) : (

                          <div>

                            <div className="flex gap-3">

                              <span className="text-[#C8A96B] font-bold">
                                •
                              </span>

                              <div className="flex-1">

                                <p className="text-white leading-relaxed">
                                  {item.CONTENIDO}
                                </p>

                                {item.OBSERVACIONES && (

                                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-500">
  {item.OBSERVACIONES}
</p>

                                )}

                              </div>

                            </div>

                          </div>

                        )}

                      </div>

                    ))}

                  </div>

                </div>

                {/* SIN BALÓN */}

                <div>

                  <h2 className="mb-6 text-xl font-bold text-[#C8A96B]">

                    SIN BALÓN

                  </h2>

                  <div className="space-y-4">

                    {sinBalon.map((item) => (

                      <div
                        key={item.ID}
                        className="border-b border-white/10 pb-4"
                      >

                        {editing ? (

  <div className="space-y-3">

    <div className="flex justify-end">
      <button
        onClick={() => borrarItem(item.ID)}
        className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
      >
        Eliminar
      </button>
    </div>

    <textarea
                              value={item.CONTENIDO}
                              rows={2}
                              onChange={(e) => {

                                setData((prev) =>
                                  prev.map((x) =>
                                    x.ID === item.ID
                                      ? {
                                          ...x,
                                          CONTENIDO:
                                            e.target.value,
                                        }
                                      : x
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
                            />

                            <textarea
                              value={
                                item.OBSERVACIONES ||
                                ""
                              }
                              rows={2}
                              placeholder="Observaciones..."
                              onChange={(e) => {

                                setData((prev) =>
                                  prev.map((x) =>
                                    x.ID === item.ID
                                      ? {
                                          ...x,
                                          OBSERVACIONES:
                                            e.target.value,
                                        }
                                      : x
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
                            />

                          </div>

                        ) : (

                          <div>

                            <div className="flex gap-3">

                              <span className="text-[#C8A96B] font-bold">
                                •
                              </span>

                              <div className="flex-1">

                                <p className="text-white leading-relaxed">
                                  {item.CONTENIDO}
                                </p>

                                {item.OBSERVACIONES && (

                                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-500">
  {item.OBSERVACIONES}
</p>

                                )}

                              </div>

                            </div>

                          </div>

                        )}

                      </div>

                    ))}

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>
{showNuevo && (

<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">

  <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#11161D] p-8">

    <h2 className="mb-6 text-2xl font-bold text-white">
      Nuevo contenido
    </h2>

    <label className="mb-2 block text-sm text-gray-400">
      Bloque
    </label>

    <select
      value={nuevo.BLOQUE}
      onChange={(e)=>
        setNuevo({
          ...nuevo,
          BLOQUE:e.target.value
        })
      }
      className="mb-5 w-full rounded-xl bg-black/30 p-3 text-white"
    >
      <option>CON BALÓN</option>
      <option>SIN BALÓN</option>
    </select>

    <label className="mb-2 block text-sm text-gray-400">
      Contenido
    </label>

    <textarea
      rows={3}
      value={nuevo.CONTENIDO}
      onChange={(e)=>
        setNuevo({
          ...nuevo,
          CONTENIDO:e.target.value
        })
      }
      className="mb-5 w-full rounded-xl bg-black/30 p-3 text-white"
    />

    <label className="mb-2 block text-sm text-gray-400">
      Observaciones
    </label>

    <textarea
      rows={3}
      value={nuevo.OBSERVACIONES}
      onChange={(e)=>
        setNuevo({
          ...nuevo,
          OBSERVACIONES:e.target.value
        })
      }
      className="mb-5 w-full rounded-xl bg-black/30 p-3 text-white"
    />

    <label className="mb-2 block text-sm text-gray-400">
      Orden
    </label>

    <input
      type="number"
      value={nuevo.ORDEN}
      onChange={(e)=>
        setNuevo({
          ...nuevo,
          ORDEN:e.target.value
        })
      }
      className="mb-8 w-full rounded-xl bg-black/30 p-3 text-white"
    />

    <div className="flex justify-end gap-3">

      <button
        onClick={()=>setShowNuevo(false)}
        className="rounded-xl border border-white/10 px-5 py-3 text-white"
      >
        Cancelar
      </button>

      <button
        onClick={crearItem}
        className="rounded-xl bg-[#C8A96B] px-5 py-3 font-semibold text-black"
      >
        Crear
      </button>

    </div>

  </div>

</div>

)}
    </div>

  );

}