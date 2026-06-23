"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
const VISIBLE_CARDS = 4;

const SHEET_JUGADORES =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkdtHaPU7QWiWPxOWJYkfpD-RvFF3dsnRDGVjh9e3rkoA9pDQFNp6WPNRZafrAMNfe8cLlBqkf9S9k/pub?gid=205498392&single=true&output=csv";

const SHEET_SEGUIMIENTO =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkdtHaPU7QWiWPxOWJYkfpD-RvFF3dsnRDGVjh9e3rkoA9pDQFNp6WPNRZafrAMNfe8cLlBqkf9S9k/pub?gid=536172864&single=true&output=csv";

const SHEET_VIDEOS =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkdtHaPU7QWiWPxOWJYkfpD-RvFF3dsnRDGVjh9e3rkoA9pDQFNp6WPNRZafrAMNfe8cLlBqkf9S9k/pub?gid=1875419243&single=true&output=csv";

const SHEET_INFORMES =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkdtHaPU7QWiWPxOWJYkfpD-RvFF3dsnRDGVjh9e3rkoA9pDQFNp6WPNRZafrAMNfe8cLlBqkf9S9k/pub?gid=1812683440&single=true&output=csv";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

  const DEFAULT_STRENGTH =
  "Fortalezas por definir";

const DEFAULT_IMPROVEMENT =
  "Aspectos de mejora por definir";

const DEFAULT_STRENGTH_VIDEO =
  "https://drive.google.com/file/d/1yZYbrjeocPk-MiG_OCO-t1hzMyv54lAY/preview";

const DEFAULT_IMPROVEMENT_VIDEO =
  "https://drive.google.com/file/d/1yZYbrjeocPk-MiG_OCO-t1hzMyv54lAY/preview";

type Player = {
  idJugador: string;
  name: string;
  position: string;
  photo: string;
  strengths?: string;
  improvements?: string;
  strengthVideo?: string;
  improvementVideo?: string;

  mentalidad?: number;
  habitos?: number;
  interpretacion?: number;
  capacidadFisica?: number;
  tecnica?: number;
};
type TrackingRecord = {
  ID_REGISTRO: string;
  ID_JUGADOR: string;
  FECHA: string;
  OBJETIVO_OFENSIVO: string;
  OBJETIVO_DEFENSIVO: string;
  OBJETIVO_MENTAL: string;
  FEEDBACK: string;
  QUIEN: string;
  MODALIDAD: string;
  MOMENTO: string;
  ESTRATEGIA: string;
};

type VideoItem = {
  ID_VIDEO: string;
  ID_JUGADOR: string;
  CATEGORIA: string;
  TITULO: string;
  DESCRIPCION: string;
  URL_VIDEO: string;
  FECHA: string;
};

type ReportItem = {
  ID_JUGADOR: string;
  RESUMEN_EJECUTIVO: string;
  FORTALEZAS_INFORME: string;
  ASPECTOS_MEJORA_INFORME: string;
  OBJETIVOS: string;
  OBSERVACIONES_FINALES: string;
};

const players: Player[] = [
  // PORTEROS
  {
    idJugador: "JUG-24",
    name: "Mestre",
    position: "Portero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/SERGIO_MESTRE_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-25",
    name: "Javi Navarro",
    position: "Portero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/JAVI_NAVARRO_550x650?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-26",
    name: "F. Quetglas",
    position: "Portero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/FERRAN_QUETGLAS_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },

  // DEFENSAS
  {
    idJugador: "JUG-01",
    name: "Fortea",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/JESUS_FORTEA_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-02",
    name: "Melvin Ukpeigbe",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/MELVIN_DB10242_380x501%20%E2%80%93%201?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-03",
    name: "Valdepeñas",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/VICTOR_VALDEPEÑAS_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-04",
    name: "Diego Aguado",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/DIEGO_AGUADO_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-06",
    name: "Álvaro Lezcano",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ALVARO%20LEZCANO_JT11325_550x650?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-05",
    name: "Manu Serrano",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/MANU_SERRANO_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-07",
    name: "Joan Martínez",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/JOAN_MARTINEZ_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-08",
    name: "Mario Rivas",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/MARIO_RIVAS_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-09",
    name: "Lamini",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/LAMINI_DB10244_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-10",
    name: "Ariel Ncoghe",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ARIEL%20NKOGHE_JT11313_550x650?$Desktop$&fit=wrap&wid=288&hei=384",
  },

  // CENTROCAMPISTAS
  {
    idJugador: "JUG-11",
    name: "Cestero",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/JORGE_CESTERO_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-12",
    name: "Cristian David",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/CRISTIAN_DAVID_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-13",
    name: "Thiago",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/THIAGO_PITARCH_550x650?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-15",
    name: "M. Rezola",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/MANEX-REZOLA_AV17806_550x650?$Desktop$&fit=wrap&wid=420",
  },
  {
    idJugador: "JUG-14",
    name: "Diego Lacosta",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/DIEGO%20LASCOSTA_JT11305_550X650?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-16",
    name: "Roberto",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ROBERTO_MARTIN_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-17",
    name: "Pol Fortuny",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/POL_FORTUNY_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-18",
    name: "Mesonero",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/DANIEL_MESONERO_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-19",
    name: "Yáñez",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/DANIEL_YAÑEZ_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-20",
    name: "Alexis Ciria",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ALEXIS-CIRIA_JT10268_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-21",
    name: "Á. Leiva",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ALVARO_LEIVA_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },

  // DELANTEROS
  {
    idJugador: "JUG-23",
    name: "Rachad",
    position: "Delantero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/RACHAD_FETTAL_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-22",
    name: "Jacobo",
    position: "Delantero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/JACOBO_ORTEGA_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
];
function normalize(text = "") {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseCSV(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
    } else if (
      (char === "\n" || char === "\r") &&
      !inQuotes
    ) {
      if (value || row.length) {
        row.push(value.trim());
        rows.push(row);
        row = [];
        value = "";
      }

      if (char === "\r" && next === "\n") {
        i++;
      }
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value.trim());
    rows.push(row);
  }

  const headers = rows[0] || [];

  return rows.slice(1).map((r) =>
    headers.reduce(
      (obj: Record<string, string>, h, i) => {
        obj[h.trim()] = (r[i] || "").trim();
        return obj;
      },
      {}
    )
  );
}
function driveViewUrl(url = "") {
  return url.replace("/view", "/preview");
}
function driveVideoUrl(url = "") {
  return url;
}
function CarouselRow({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: Player[];
  onSelect: (p: Player) => void;
}) {
  const [index, setIndex] = useState(0);

  if (!items.length) return null;

  const canSlide = items.length > VISIBLE_CARDS;

  const visible = canSlide
    ? Array.from({
        length: VISIBLE_CARDS,
      }).map(
        (_, i) =>
          items[
            (index + i) % items.length
          ]
      )
    : items;

  return (
    <div className="mb-12">
      <div className="mb-5 flex items-center gap-4">
        <h2 className="text-lg font-semibold">
          {title}
        </h2>

        <div className="h-px flex-1 bg-white/10" />

        {canSlide && (
          <div className="flex gap-2">
            <button
              onClick={() =>
                setIndex(
                  (v) =>
                    (v - 1 + items.length) %
                    items.length
                )
              }
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              onClick={() =>
                setIndex(
                  (v) =>
                    (v + 1) %
                    items.length
                )
              }
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
        {visible.map((player) => (
          <button
            key={player.name}
            onClick={() =>
              onSelect(player)
            }
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-3 sm:p-4 lg:p-5 text-center"
          >
            <div className="flex justify-center">
              <img
                src={player.photo}
                alt={player.name}
                className="h-[120px] w-[90px] sm:h-[140px] sm:w-[110px] lg:h-[150px] lg:w-[120px] rounded-2xl object-cover object-top"
              />
            </div>

            <h3 className="mt-4 text-base font-semibold">
              {player.name}
            </h3>

            <p className="mt-1 text-sm text-gray-400">
              {player.position}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function IndividualPage() {
  const [search, setSearch] =
    useState("");

  const [selected, setSelected] =
    useState<Player | null>(null);

  const [sheetData, setSheetData] =
  useState<any[]>([]);

const [trackingData, setTrackingData] =
  useState<TrackingRecord[]>([]);

const [videoData, setVideoData] =
  useState<VideoItem[]>([]);

const [reportData, setReportData] =
  useState<ReportItem[]>([]);

const [activeTab, setActiveTab] =
  useState<
    "perfil" |
    "seguimiento" |
    "videos" |
    "informe"
  >("perfil");
   const [isMobile, setIsMobile] =
  useState(false);
const [showTrackingForm, setShowTrackingForm] =
  useState(false);
  const [showProfileForm, setShowProfileForm] =
  useState(false);
const [showVideoForm, setShowVideoForm] =

  useState(false);



const [editingVideo, setEditingVideo] =

  useState<VideoItem | null>(null);



const [videoForm, setVideoForm] =

  useState({

    CATEGORIA: "",

    TITULO: "",

    DESCRIPCION: "",

    URL_VIDEO: "",

    FECHA: "",

  });
const [profileForm, setProfileForm] =
  useState({
    strengths: "",
    improvements: "",
    strengthVideo: "",
    improvementVideo: "",
    mentalidad: "",
    habitos: "",
    interpretacion: "",
    capacidadFisica: "",
    tecnica: "",
  });
  const [editingTracking, setEditingTracking] =
  useState<TrackingRecord | null>(null);
 const [trackingForm, setTrackingForm] =
  useState({
    FECHA: "",
    OBJETIVO_OFENSIVO: "",
    OBJETIVO_DEFENSIVO: "",
    OBJETIVO_MENTAL: "",
    FEEDBACK: "",
    QUIEN: "",
    MODALIDAD: "",
    MOMENTO: "",
    ESTRATEGIA: "",
  });

useEffect(() => {
  const checkMobile = () => {
    const touchDevice =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0;

    setIsMobile(touchDevice);
  };

  checkMobile();

  window.addEventListener(
    "resize",
    checkMobile
  );

  return () =>
    window.removeEventListener(
      "resize",
      checkMobile
    );
}, []);
useEffect(() => {
  if (!selected) return;

  const originalOverflow =
    document.body.style.overflow;

  document.body.style.overflow =
    "hidden";

  return () => {
    document.body.style.overflow =
      originalOverflow;
  };
}, [selected]);
useEffect(() => {
  Promise.allSettled([
    fetch(
      `${APPS_SCRIPT_URL}?action=jugadores`
    ).then((r) => r.json()),

    fetch(
      `${APPS_SCRIPT_URL}?action=seguimiento`
    ).then((r) => r.json()),

    fetch(SHEET_VIDEOS).then((r) =>
      r.text()
    ),

    fetch(SHEET_INFORMES).then(
      (r) => r.text()
    ),
  ]).then((results) => {
    console.log("RESULTADOS:");
    console.log(results);

    const jugadores =
      results[0].status === "fulfilled"
        ? results[0].value
        : [];

    const seguimiento =
      results[1].status === "fulfilled"
        ? results[1].value
        : [];

    const videos =
      results[2].status === "fulfilled"
        ? results[2].value
        : "";

    const informes =
      results[3].status === "fulfilled"
        ? results[3].value
        : "";

    console.log("JUGADORES RECIBIDOS", jugadores);console.log("KEYS", Object.keys(jugadores));console.log(
  "TIPO",
  typeof jugadores
);

console.log(
  "ARRAY?",
  Array.isArray(jugadores)
);

console.log(
  "CONTENIDO",
  JSON.stringify(jugadores)
);

setSheetData(
  Array.isArray(jugadores)
    ? jugadores
    : jugadores.data || []
);

    setTrackingData(
      seguimiento as TrackingRecord[]
    ); 

    setVideoData(
      parseCSV(videos) as VideoItem[]
    );

    setReportData(
      parseCSV(informes) as ReportItem[]
    );
  });
}, []);

const saveTracking = async () => {
  if (!selected) return;

  try {
   const payload = {
  action: editingTracking
    ? "editarSeguimiento"
    : "crearSeguimiento",

  ID_REGISTRO:
    editingTracking?.ID_REGISTRO,

  ID_JUGADOR:
    selected.idJugador,

  ...trackingForm,
};

console.log("EDITAR ENVIA:");
console.log(payload);

const response = await fetch(
  APPS_SCRIPT_URL,
  {
    method: "POST",
    headers: {
      "Content-Type":
        "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  }
);

const text = await response.text();

console.log("EDITAR RESPUESTA:");
console.log(text);

const result = JSON.parse(text);


    if (result.success) {
      if (editingTracking) {
  setTrackingData((prev) =>
    prev.map((r) =>
      r.ID_REGISTRO ===
      editingTracking.ID_REGISTRO
        ? {
            ...r,
            ...trackingForm,
          }
        : r
    )
  );

  setEditingTracking(null);

  setShowTrackingForm(false);

  return;
}
      alert(
        "Seguimiento guardado correctamente"
      );

      setShowTrackingForm(false);

      setTrackingForm({
        FECHA: "",
        OBJETIVO_OFENSIVO: "",
        OBJETIVO_DEFENSIVO: "",
        OBJETIVO_MENTAL: "",
        FEEDBACK: "",
        QUIEN: "",
        MODALIDAD: "",
        MOMENTO: "",
        ESTRATEGIA: "",
      });

      const nuevoRegistro = {
  ID_REGISTRO: result.id,
  ID_JUGADOR: selected.idJugador,
  ...trackingForm,
};

setTrackingData((prev) => [
  nuevoRegistro,
  ...prev,
]);
    } else {
      alert(
        "Error guardando seguimiento"
      );
    }
  } catch (error) {
    console.error(error);

    alert(
      "Error de conexión"
    );
  }
}; 

const deleteTracking = async (
  idRegistro: string
) => {
  if (
    !confirm(
      "¿Eliminar este seguimiento?"
    )
  )
    return;

  try {
    const payload = {
  action: "eliminarSeguimiento",
  ID_REGISTRO: idRegistro,
};

console.log("BORRAR ENVIA:");
console.log(payload);

const response = await fetch(
  APPS_SCRIPT_URL,
  {
    method: "POST",
    headers: {
      "Content-Type":
        "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  }
);

const text = await response.text();

console.log("BORRAR RESPUESTA:");
console.log(text);

const result = JSON.parse(text);

    if (result.success) {
      setTrackingData((prev) =>
        prev.filter(
          (r) =>
            r.ID_REGISTRO !==
            idRegistro
        )
      );
    }
  } catch (err) {
    console.error(err);
  }
};
const mergedPlayers =
    useMemo(() => {
      return players.map((p) => {
        const row =
  sheetData.find(
    (r) =>
      r.ID_JUGADOR ===
      p.idJugador
  ) || {};

        return {
  ...p,
  strengths:
    row.strengths ||
    DEFAULT_STRENGTH,

  improvements:
    row.improvements ||
    DEFAULT_IMPROVEMENT,

  strengthVideo:
    row.strengthVideo ||
    DEFAULT_STRENGTH_VIDEO,

  improvementVideo:
    row.improvementVideo ||
    DEFAULT_IMPROVEMENT_VIDEO,

  mentalidad: Number(
  row.MENTALIDAD || 0
),

habitos: Number(
  row.HABITOS || 0
),

interpretacion: Number(
  row.INTERPRETACION || 0
),

capacidadFisica: Number(
  row.CAPACIDAD_FISICA || 0
),

tecnica: Number(
  row.TECNICA || 0
),
};
      });
    }, [sheetData]);

  const filtered =
    mergedPlayers.filter((p) =>
      normalize(p.name).includes(
        normalize(search)
      )
    );

  const grouped = {
    Porteros: filtered.filter(
      (p) =>
        p.position === "Portero"
    ),
    Defensas: filtered.filter(
      (p) =>
        p.position === "Defensa"
    ),
    Centrocampistas:
      filtered.filter(
        (p) =>
          p.position ===
          "Centrocampista"
      ),
    Delanteros: filtered.filter(
      (p) =>
        p.position === "Delantero"
    ),
  };
const playerTracking = selected
  ? trackingData
      .filter(
        (item) =>
          item.ID_JUGADOR ===
          selected.idJugador
      )
      .sort(
        (a, b) =>
          new Date(b.FECHA).getTime() -
          new Date(a.FECHA).getTime()
      )
  : [];

const playerVideos = selected
  ? videoData.filter(
      (item) =>
        item.ID_JUGADOR ===
        selected.idJugador
    )
  : [];

const playerReport = selected
  ? reportData.find(
      (item) =>
        item.ID_JUGADOR ===
        selected.idJugador
    )
  : null;
  return (
    <>
      <main className="min-h-screen bg-[#0B0F14] text-white">
        <div className="flex flex-col lg:flex-row">
          <Sidebar />

          <section className="flex-1 min-w-0">
            <Topbar />

            <div className="p-4 sm:p-6 lg:p-10">
               <div className="mb-8">
              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                                RMCF CASTILLA INDIVIDUAL
              </p>

              <div className="mt-4 flex flex-col items-start gap-4 lg:flex-row lg:items-center">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight">
                 Seguimiento
                </h1>

                <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
              </div>
            </div>

              <div className="mb-8 max-w-md">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <Search className="h-4 w-4 text-gray-400" />

                  <input
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                    placeholder="Search player..."
                    className="w-full bg-transparent outline-none"
                  />
                </div>
              </div>

              <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-4 sm:p-6 lg:p-8">
                <CarouselRow
                  title="Porteros"
                  items={
                    grouped.Porteros
                  }
                  onSelect={
                    setSelected
                  }
                />

                <CarouselRow
                  title="Defensas"
                  items={
                    grouped.Defensas
                  }
                  onSelect={
                    setSelected
                  }
                />

                <CarouselRow
                  title="Centrocampistas"
                  items={
                    grouped.Centrocampistas
                  }
                  onSelect={
                    setSelected
                  }
                />

                <CarouselRow
                  title="Delanteros"
                  items={
                    grouped.Delanteros
                  }
                  onSelect={
                    setSelected
                  }
                />
              </div>
            </div>
          </section>
        </div>
      </main>

     {selected &&
  createPortal(
    <div
      className="
        fixed
        inset-0
        z-[99999]
        bg-black/75
        p-2 sm:p-6
        overflow-hidden
        flex
        items-center
        justify-center
      "
      onClick={() => setSelected(null)}
    >
      <div
        className="
          relative
          w-full
          max-w-6xl
          h-[92dvh]
          overflow-y-auto
          overflow-x-hidden
          rounded-3xl
          border border-white/10
          bg-[#11161C]
          p-4 sm:p-6 lg:p-8
        "
        style={{
          WebkitOverflowScrolling: "touch",
        }}
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        <button
          onClick={() =>
            setSelected(null)
          }
          className="absolute right-5 top-5"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid gap-6 lg:gap-8 md:grid-cols-[340px_1fr]">
          <div>
            <img
              src={selected.photo}
              alt={selected.name}
              className="h-[360px] w-full rounded-2xl object-cover object-top"
            />

            <h2 className="mt-5 text-3xl font-semibold">
              {selected.name}
            </h2>

            <p className="mt-2 text-gray-400">
              {selected.position}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
  {[
    {
      key: "perfil",
      label: "Perfil",
    },
    {
      key: "seguimiento",
      label: "Seguimiento",
    },
    {
      key: "videos",
      label: "Vídeos",
    },
    {
      key: "informe",
      label: "Informe",
    },
  ].map((tab) => (
    <button
      key={tab.key}
      onClick={() =>
        setActiveTab(
          tab.key as any
        )
      }
      className={`rounded-xl px-4 py-2 text-sm ${
        activeTab === tab.key
          ? "bg-[#C8A96B] text-black"
          : "bg-white/5 text-white"
      }`}
    >
      {tab.label}
    </button>
  ))}
</div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 min-w-0">
  <h3 className="mb-4 text-center text-sm font-medium text-[#C8A96B]">
    Perfil competencial
  </h3>

  <div className="h-[280px] w-full min-w-0">
    <ResponsiveContainer
      width="100%"
      height="100%"
    >
      <RadarChart
        data={[
          {
            subject: "Mentalidad",
            value:
              selected.mentalidad || 0,
          },
          {
            subject: "Hábitos",
            value:
              selected.habitos || 0,
          },
          {
            subject:
              "Interpretación",
            value:
              selected.interpretacion ||
              0,
          },
          {
            subject:
              "Cap. Física",
            value:
              selected.capacidadFisica ||
              0,
          },
          {
            subject: "Técnica",
            value:
              selected.tecnica || 0,
          },
        ]}
      >
        <PolarGrid
          stroke="rgba(255,255,255,0.15)"
        />

        <PolarAngleAxis
          dataKey="subject"
          tick={{
            fill: "#ffffff",
            fontSize: 11,
          }}
        />

        <PolarRadiusAxis
          domain={[0, 10]}
          tick={false}
          axisLine={false}
        />

        <Radar
          dataKey="value"
          stroke="#C8A96B"
          fill="#C8A96B"
          fillOpacity={0.45}
        />
      </RadarChart>
    </ResponsiveContainer>
  </div>

  <div className="mt-4 space-y-2">
    {[
      {
        label: "Mentalidad",
        value:
          selected.mentalidad || 0,
      },
      {
        label: "Hábitos",
        value:
          selected.habitos || 0,
      },
      {
        label: "Interpretación",
        value:
          selected.interpretacion ||
          0,
      },
      {
        label: "Capacidad física",
        value:
          selected.capacidadFisica ||
          0,
      },
      {
        label: "Técnica",
        value:
          selected.tecnica || 0,
      },
    ].map((item) => (
      <div key={item.label}>
        <div className="mb-1 flex justify-between text-xs">
          <span>
            {item.label}
          </span>
          <span>
            {item.value}/10
          </span>
        </div>

        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#C8A96B]"
            style={{
              width: `${
                item.value * 10
              }%`,
            }}
          />
        </div>
      </div>
    ))}
  </div>
</div>
          </div>
        {activeTab === "perfil" && (
  <>
    <div className="mb-4">
      <button
        onClick={() => {
          setProfileForm({
            strengths: selected.strengths || "",
            improvements: selected.improvements || "",
            strengthVideo: selected.strengthVideo || "",
            improvementVideo: selected.improvementVideo || "",
            mentalidad: String(selected.mentalidad || ""),
            habitos: String(selected.habitos || ""),
            interpretacion: String(selected.interpretacion || ""),
            capacidadFisica: String(selected.capacidadFisica || ""),
            tecnica: String(selected.tecnica || ""),
          });

          setShowProfileForm(true);
        }}
        className="
          rounded-xl
          bg-[#C8A96B]
          px-4
          py-2
          text-black
          text-sm
        "
      >
        Editar perfil
      </button>
    </div>

    <div className="space-y-10">
      {/* FORTALEZAS */}
      ...
      {/* MEJORA */}
      ...
    </div>
  </>
)}
          {activeTab === "seguimiento" && (
  <div className="space-y-4">

    <h3 className="text-xl font-semibold text-[#C8A96B]">
      Seguimiento individual
    </h3>
    <div className="mb-4">
  <button
    onClick={() => {
  setEditingTracking(null);

  setTrackingForm({
    FECHA: "",
    OBJETIVO_OFENSIVO: "",
    OBJETIVO_DEFENSIVO: "",
    OBJETIVO_MENTAL: "",
    FEEDBACK: "",
    QUIEN: "",
    MODALIDAD: "",
    MOMENTO: "",
    ESTRATEGIA: "",
  });

  setShowTrackingForm(true);
}}
    className="
      rounded-xl
      bg-[#C8A96B]
      px-4
      py-2
      text-sm
      font-medium
      text-black
    "
  >
    {editingTracking
  ? "Editar seguimiento"
  : "Nuevo seguimiento"}
  </button>
</div>
{playerTracking.length === 0 && (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-gray-400">
    No hay seguimientos registrados.
  </div>
)}
    {playerTracking.map((item) => (
      <div
        key={item.ID_REGISTRO}
        className="
          rounded-2xl
          border
          border-white/10
          bg-white/[0.03]
          p-5
        "
      >
        <div className="mb-4 flex items-center justify-between">
  <div className="text-sm text-[#C8A96B]">
    {item.FECHA}
  </div>

  <div className="flex gap-2">

    <button
      onClick={() => {
        setEditingTracking(item);

        setTrackingForm({
          FECHA: item.FECHA,
          OBJETIVO_OFENSIVO:
            item.OBJETIVO_OFENSIVO,
          OBJETIVO_DEFENSIVO:
            item.OBJETIVO_DEFENSIVO,
          OBJETIVO_MENTAL:
            item.OBJETIVO_MENTAL,
          FEEDBACK:
            item.FEEDBACK,
          QUIEN:
            item.QUIEN,
          MODALIDAD:
            item.MODALIDAD,
          MOMENTO:
            item.MOMENTO,
          ESTRATEGIA:
            item.ESTRATEGIA,
        });

        setShowTrackingForm(true);
      }}
      className="rounded-lg bg-blue-500 px-3 py-1 text-xs"
    >
      Editar
    </button>

    <button
      onClick={() =>
        deleteTracking(
          item.ID_REGISTRO
        )
      }
      className="rounded-lg bg-red-500 px-3 py-1 text-xs"
    >
      Borrar
    </button>

  </div>
</div>

        <div className="grid gap-4">

          <div>
            <h4 className="font-medium mb-1">
              Objetivo ofensivo
            </h4>

            <p className="text-gray-300">
              {item.OBJETIVO_OFENSIVO}
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-1">
              Objetivo defensivo
            </h4>

            <p className="text-gray-300">
              {item.OBJETIVO_DEFENSIVO}
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-1">
              Objetivo mental
            </h4>

            <p className="text-gray-300">
              {item.OBJETIVO_MENTAL}
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-1">
              Feedback
            </h4>

            <p className="text-gray-300">
              {item.FEEDBACK}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">

            <span className="rounded-full bg-white/5 px-3 py-1 text-xs">
              {item.QUIEN}
            </span>

            <span className="rounded-full bg-white/5 px-3 py-1 text-xs">
              {item.MODALIDAD}
            </span>

            <span className="rounded-full bg-white/5 px-3 py-1 text-xs">
              {item.MOMENTO}
            </span>

            <span className="rounded-full bg-[#C8A96B]/20 px-3 py-1 text-xs text-[#C8A96B]">
              {item.ESTRATEGIA}
            </span>

          </div>
        </div>
      </div>
    ))}
  </div>
)}{activeTab === "videos" && (
  <div className="space-y-6">

    <h3 className="text-xl font-semibold text-[#C8A96B]">
      Biblioteca de vídeos
    </h3>
{playerVideos.length === 0 && (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-gray-400">
    No hay vídeos registrados.
  </div>
)}<button
  onClick={() => {
    setEditingVideo(null);

    setVideoForm({
      CATEGORIA: "",
      TITULO: "",
      DESCRIPCION: "",
      URL_VIDEO: "",
      FECHA: "",
    });

    setShowVideoForm(true);
  }}
  className="
    rounded-xl
    bg-[#C8A96B]
    px-4
    py-2
    text-black
  "
>
  Nuevo vídeo
</button>
    {playerVideos.map((video) => (
      <div
        key={video.ID_VIDEO}
        className="
          rounded-2xl
          border
          border-white/10
          bg-white/[0.03]
          p-5
        "
      >
        <div className="mb-2 text-sm text-[#C8A96B]">
          {video.CATEGORIA}
        </div>

        <h4 className="text-lg font-semibold">
          {video.TITULO}
        </h4>

        <p className="mt-2 text-gray-300">
          {video.DESCRIPCION}
        </p>

        <div className="mt-4">
          <a
            href={video.URL_VIDEO}
            target="_blank"
            rel="noopener noreferrer"
            className="
              inline-flex
              items-center
              rounded-xl
              bg-[#C8A96B]
              px-4
              py-2
              text-sm
              font-medium
              text-black
            "
          >
            Ver vídeo
          </a>
        </div>
      </div>
    ))}
  </div>
)}{activeTab === "informe" && (
  <div className="space-y-6">

    <h3 className="text-xl font-semibold text-[#C8A96B]">
      Informe individual
    </h3>

    {playerReport && (
      <>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="mb-3 text-[#C8A96B]">
            Resumen ejecutivo
          </h4>

          <p className="text-gray-300">
            {playerReport?.RESUMEN_EJECUTIVO}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="mb-3 text-[#C8A96B]">
            Fortalezas
          </h4>

          <p className="text-gray-300">
            {playerReport?.FORTALEZAS_INFORME}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="mb-3 text-[#C8A96B]">
            Aspectos de mejora
          </h4>

          <p className="text-gray-300">
            {playerReport?.ASPECTOS_MEJORA_INFORME}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="mb-3 text-[#C8A96B]">
            Objetivos
          </h4>

          <p className="text-gray-300 whitespace-pre-line">
            {playerReport?.OBJETIVOS}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h4 className="mb-3 text-[#C8A96B]">
            Observaciones finales
          </h4>

          <p className="text-gray-300">
            {playerReport?.OBSERVACIONES_FINALES}
          </p>
        </div>
      </>
    )}
  </div>
)}{showTrackingForm && (
  <div className="fixed inset-0 z-[999999] bg-black/70 flex items-center justify-center p-4">
    <div
      className="
        w-full
        max-w-3xl
        rounded-3xl
        border
        border-white/10
        bg-[#11161C]
        p-6
        max-h-[90vh]
        overflow-y-auto
      "
    >
      <h3 className="mb-6 text-2xl font-semibold text-[#C8A96B]">
        Nuevo seguimiento
      </h3>

      <div className="grid gap-4">

        <input
          type="date"
          value={trackingForm.FECHA}
          onChange={(e) =>
            setTrackingForm({
              ...trackingForm,
              FECHA: e.target.value,
            })
          }
          className="rounded-xl bg-white/5 p-3"
        />

        <textarea
          placeholder="Objetivo ofensivo"
          value={
            trackingForm.OBJETIVO_OFENSIVO
          }
          onChange={(e) =>
            setTrackingForm({
              ...trackingForm,
              OBJETIVO_OFENSIVO:
                e.target.value,
            })
          }
          className="rounded-xl bg-white/5 p-3 min-h-[90px]"
        />

        <textarea
          placeholder="Objetivo defensivo"
          value={
            trackingForm.OBJETIVO_DEFENSIVO
          }
          onChange={(e) =>
            setTrackingForm({
              ...trackingForm,
              OBJETIVO_DEFENSIVO:
                e.target.value,
            })
          }
          className="rounded-xl bg-white/5 p-3 min-h-[90px]"
        />

        <textarea
          placeholder="Objetivo mental"
          value={
            trackingForm.OBJETIVO_MENTAL
          }
          onChange={(e) =>
            setTrackingForm({
              ...trackingForm,
              OBJETIVO_MENTAL:
                e.target.value,
            })
          }
          className="rounded-xl bg-white/5 p-3 min-h-[90px]"
        />

        <textarea
          placeholder="Feedback"
          value={trackingForm.FEEDBACK}
          onChange={(e) =>
            setTrackingForm({
              ...trackingForm,
              FEEDBACK:
                e.target.value,
            })
          }
          className="rounded-xl bg-white/5 p-3 min-h-[120px]"
        />

        <div className="grid md:grid-cols-2 gap-4">

          <input
            placeholder="Quién"
            value={trackingForm.QUIEN}
            onChange={(e) =>
              setTrackingForm({
                ...trackingForm,
                QUIEN:
                  e.target.value,
              })
            }
            className="rounded-xl bg-white/5 p-3"
          />

          <input
            placeholder="Modalidad"
            value={
              trackingForm.MODALIDAD
            }
            onChange={(e) =>
              setTrackingForm({
                ...trackingForm,
                MODALIDAD:
                  e.target.value,
              })
            }
            className="rounded-xl bg-white/5 p-3"
          />

          <input
            placeholder="Momento"
            value={
              trackingForm.MOMENTO
            }
            onChange={(e) =>
              setTrackingForm({
                ...trackingForm,
                MOMENTO:
                  e.target.value,
              })
            }
            className="rounded-xl bg-white/5 p-3"
          />

          <input
            placeholder="Estrategia"
            value={
              trackingForm.ESTRATEGIA
            }
            onChange={(e) =>
              setTrackingForm({
                ...trackingForm,
                ESTRATEGIA:
                  e.target.value,
              })
            }
            className="rounded-xl bg-white/5 p-3"
          />

        </div>

        <div className="flex justify-end gap-3 pt-4">

          <button
            onClick={() =>
              setShowTrackingForm(
                false
              )
            }
            className="
              rounded-xl
              border
              border-white/10
              px-5
              py-3
            "
          >
            Cancelar
          </button>

          <button
            onClick={saveTracking}
            className="
              rounded-xl
              bg-[#C8A96B]
              px-5
              py-3
              font-medium
              text-black
            "
          >
            {editingTracking
  ? "Actualizar seguimiento"
  : "Guardar seguimiento"}
          </button>
 
        </div>
      </div>
    </div>
  </div>
)}
        </div>
      </div>
    </div>,
    document.body
    
  )}
    </>
  );
}