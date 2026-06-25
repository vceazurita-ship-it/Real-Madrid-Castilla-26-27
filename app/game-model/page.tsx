"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Papa from "papaparse";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

type Principio = {
  ID: number;
  FASE: string;
  BLOQUE: string;
  APARTADO: string;
  PRINCIPIO: string;
  ORDEN: number;
  OBSERVACIONES?: string;
};

const API =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

export default function GameModelPage() {
  const [data, setData] = useState<Principio[]>([]);
const [originalData, setOriginalData] =
  useState<Principio[]>([]);

  const [fase, setFase] =
    useState("ATAQUE");

  const [bloque, setBloque] =
    useState("");

  const [apartado, setApartado] =
    useState("");

  const [editing, setEditing] =
    useState(false);

  useEffect(() => {

 fetch(
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1322156567&single=true&output=csv"
)
    .then((r) => r.text())
    .then((csv) => {

      const parsed =
        Papa.parse<Principio>(
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

        setFase(
          rows[0].FASE
        );

        setBloque(
          rows[0].BLOQUE
        );

        setApartado(
          rows[0].APARTADO
        );
      }
    })
    .catch((err) => {
      console.error(err);
    });

}, []);

  const bloques = useMemo(() => {
  if (!Array.isArray(data)) return [];

  return [
    ...new Set(
      data
        .filter(
          (r) => r?.FASE === fase
        )
        .map((r) => r.BLOQUE)
    ),
  ];
}, [data, fase]);

  const apartados = useMemo(() => {
  if (!Array.isArray(data)) return [];

  return [
    ...new Set(
      data
        .filter(
          (r) =>
            r?.FASE === fase &&
            r?.BLOQUE === bloque
        )
        .map((r) => r.APARTADO)
    ),
  ];
}, [data, fase, bloque]);

 const principios = useMemo(() => {
  if (!Array.isArray(data)) return [];

  return data
    .filter(
      (r) =>
        r?.FASE === fase &&
        r?.BLOQUE === bloque &&
        r?.APARTADO === apartado
    )
    .sort(
      (a, b) =>
        Number(a.ORDEN) -
        Number(b.ORDEN)
    );
}, [
  data,
  fase,
  bloque,
  apartado,
]);
const guardarCambios = async () => {
  try {

    const cambios = data.filter((item) => {
      const original = originalData.find(
        (o) => o.ID === item.ID
      );

      return (
        original?.PRINCIPIO !== item.PRINCIPIO ||
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
          `${API}?action=guardarPrincipio&ID=${p.ID}&PRINCIPIO=${encodeURIComponent(
            p.PRINCIPIO
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
  p-4
  lg:p-6
  "
>
            <div className="mb-8 flex gap-2">
              <button
  onClick={() => {
    setFase("ATAQUE");

    const primerBloque = data.find(
      (r) => r.FASE === "ATAQUE"
    )?.BLOQUE || "";

    const primerApartado = data.find(
      (r) =>
        r.FASE === "ATAQUE" &&
        r.BLOQUE === primerBloque
    )?.APARTADO || "";

    setBloque(primerBloque);
    setApartado(primerApartado);
  }}
  className={`flex-1 rounded-xl py-3 font-medium ${
    fase === "ATAQUE"
      ? "bg-[#C8A96B] text-black"
      : "border border-white/10 text-white"
  }`}
>
  ATAQUE
</button>

<button
  onClick={() => {
    setFase("DEFENSA");

    const primerBloque = data.find(
      (r) => r.FASE === "DEFENSA"
    )?.BLOQUE || "";

    const primerApartado = data.find(
      (r) =>
        r.FASE === "DEFENSA" &&
        r.BLOQUE === primerBloque
    )?.APARTADO || "";

    setBloque(primerBloque);
    setApartado(primerApartado);
  }}
  className={`flex-1 rounded-xl py-3 font-medium ${
    fase === "DEFENSA"
      ? "bg-[#C8A96B] text-black"
      : "border border-white/10 text-white"
  }`}
>
  DEFENSA
</button>
            </div>

            <div
  className="
  flex
  gap-2
  overflow-x-auto
  pb-2
  scrollbar-hide
  lg:block
  lg:space-y-2
  "
>
              {bloques.map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    setBloque(b);

                    const primerApartado =
                      data.find(
                        (r) =>
                          r.FASE === fase &&
                          r.BLOQUE === b
                      )?.APARTADO || "";

                    setApartado(
                      primerApartado
                    );
                  }}
                  className={`
shrink-0
min-w-[140px]
lg:w-full
rounded-xl
px-4
py-3
text-left text-left ${
                    bloque === b
                      ? "bg-[#C8A96B] text-black"
                      : "border border-white/10 text-white"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            {apartados.length > 0 && (
              <>
                <div className="mt-8 mb-3 text-xs uppercase tracking-widest text-gray-500">
                  APARTADOS
                </div>

                <div
  className="
  flex
  gap-2
  overflow-x-auto
  pb-2
  scrollbar-hide
  lg:block
  lg:space-y-2
  "
>
                  {apartados.map((a) => (
                    <button
                      key={a}
                      onClick={() =>
                        setApartado(a)
                      }
                      className={`
shrink-0
min-w-[140px]
lg:w-full
rounded-xl
px-4
py-3
text-left text-sm ${
                        apartado === a
                          ? "border border-[#C8A96B] text-[#C8A96B]"
                          : "border border-white/10 text-gray-300"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* CONTENIDO */}

          <div className="flex-1 min-w-0 p-4 lg:p-8">
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
                  {fase}
                </p>

                <h1
  className="
  text-xl
  sm:text-2xl
  lg:text-3xl
  font-semibold
  text-white
  break-words
  "
>
                  {apartado}
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
              {principios.map((p) => (
                <div
                  key={p.ID}
                  className="
  rounded-2xl
  border
  border-white/10
  bg-white/[0.03]
  p-4
  lg:p-5
  "
                >
                  <div className="flex items-start gap-3 lg:gap-4 min-w-0">
                    <div
  className="
flex
shrink-0
h-8
w-8
lg:h-10
lg:w-10
items-center
justify-center
rounded-full
bg-[#C8A96B]
text-xs
lg:text-sm
font-bold
text-black
"
>
                      {p.ORDEN}
                    </div>

                    <div className="flex-1 min-w-0">
                     {editing ? (
  <div className="space-y-3">
    <textarea
      value={p.PRINCIPIO}
      onChange={(e) => {
        setData((prev) =>
          prev.map((item) =>
            item.ID === p.ID
              ? {
                  ...item,
                  PRINCIPIO:
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
    <p
  className="
  text-sm
  lg:text-base
  text-white
  leading-relaxed
  break-words
  "
>
      {p.PRINCIPIO}
    </p>

    {p.OBSERVACIONES && (
      <p
  className="
  mt-2
  text-xs
  lg:text-sm
  text-gray-400
  break-words
  "
>
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