"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

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

  const [fase, setFase] =
    useState("ATAQUE");

  const [bloque, setBloque] =
    useState("");

  const [apartado, setApartado] =
    useState("");

  const [editing, setEditing] =
    useState(false);

  useEffect(() => {
  fetch(`${API}?action=identidad`)
    .then((r) => r.json())
    .then((rows) => {
      let parsed: Principio[] = [];

      if (Array.isArray(rows)) {
        parsed = rows;
      } else if (
        rows &&
        Array.isArray(rows.data)
      ) {
        parsed = rows.data;
      }

      setData(parsed);

      if (parsed.length > 0) {
        setBloque(parsed[0].BLOQUE);
        setApartado(parsed[0].APARTADO);
      }
    })
    .catch((err) => {
      console.error(err);
      setData([]);
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

  return (
    <div className="flex min-h-screen bg-[#0B0F14]">
      <Sidebar />

      <div className="flex-1">
        <Topbar />

        <div className="flex">
          {/* MENÚ IZQUIERDO */}

          <div className="w-[340px] border-r border-white/10 p-6">
            <div className="mb-8 flex gap-2">
              <button
                onClick={() =>
                  setFase("ATAQUE")
                }
                className={`flex-1 rounded-xl py-3 font-medium ${
                  fase === "ATAQUE"
                    ? "bg-[#C8A96B] text-black"
                    : "border border-white/10 text-white"
                }`}
              >
                ATAQUE
              </button>

              <button
                onClick={() =>
                  setFase("DEFENSA")
                }
                className={`flex-1 rounded-xl py-3 font-medium ${
                  fase === "DEFENSA"
                    ? "bg-[#C8A96B] text-black"
                    : "border border-white/10 text-white"
                }`}
              >
                DEFENSA
              </button>
            </div>

            <div className="space-y-2">
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
                  className={`w-full rounded-xl p-3 text-left ${
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

                <div className="space-y-2">
                  {apartados.map((a) => (
                    <button
                      key={a}
                      onClick={() =>
                        setApartado(a)
                      }
                      className={`w-full rounded-xl p-3 text-left text-sm ${
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

          <div className="flex-1 p-8">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
                  {fase}
                </p>

                <h1 className="text-3xl font-semibold text-white">
                  {apartado}
                </h1>
              </div>

              <button
                onClick={() =>
                  setEditing(!editing)
                }
                className="rounded-xl border border-[#C8A96B] px-4 py-2 text-[#C8A96B]"
              >
                {editing
                  ? "Cancelar"
                  : "Editar"}
              </button>
            </div>

            <div className="space-y-3">
              {principios.map((p) => (
                <div
                  key={p.ID}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C8A96B] text-sm font-bold text-black">
                      {p.ORDEN}
                    </div>

                    <div className="flex-1">
                      <p className="text-white">
                        {p.PRINCIPIO}
                      </p>

                      {p.OBSERVACIONES && (
                        <p className="mt-2 text-sm text-gray-400">
                          {
                            p.OBSERVACIONES
                          }
                        </p>
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