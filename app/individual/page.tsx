"use client";

import { useMemo, useState } from "react";

const DEFAULT_STRENGTH =
  "Información de fortalezas pendiente de actualizar.";

const DEFAULT_IMPROVEMENT =
  "Información de aspectos de mejora pendiente de actualizar.";

const DEFAULT_STRENGTH_VIDEO =
  "https://www.youtube.com/embed/ysz5S6PUM-U";

const DEFAULT_IMPROVEMENT_VIDEO =
  "https://www.youtube.com/embed/dQw4w9WgXcQ";

const players = [
  {
    name: "F. Quetglas",
    position: "Portero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/FERRAN_QUETGLAS_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
    strengths:
      "Buen juego aéreo, reflejos rápidos en situaciones de área y personalidad competitiva bajo presión.",
    improvements:
      "Seguir mejorando la precisión en el juego con el pie y la continuidad en salida desde atrás.",
    strengthVideo:
      "https://www.youtube.com/embed/ysz5S6PUM-U",
    improvementVideo:
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },

  {
    name: "D. Arroyo",
    position: "Portero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/DIEGO_ARROYO_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
    strengths:
      "Portero con buena presencia en portería, capacidad de reacción y seguridad en acciones cercanas.",
    improvements:
      "Seguir evolucionando en timing de salidas y comunicación defensiva.",
    strengthVideo:
      "https://www.youtube.com/embed/ysz5S6PUM-U",
    improvementVideo:
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },

  {
    name: "Á. González",
    position: "Portero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ALVARO_GONZALEZ_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
    strengths:
      "Buen posicionamiento y lectura de trayectorias en acciones defensivas.",
    improvements:
      "Mayor precisión en desplazamientos largos y toma de decisión en juego rápido.",
    strengthVideo:
      "https://www.youtube.com/embed/ysz5S6PUM-U",
    improvementVideo:
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },

  {
    name: "A. Moya",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ALEJANDRO_MOYA_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
    strengths:
      "Defensor sólido en duelos individuales, buena lectura táctica y agresividad defensiva.",
    improvements:
      "Seguir creciendo en salida de balón y cambios de orientación.",
    strengthVideo:
      "https://www.youtube.com/embed/ysz5S6PUM-U",
    improvementVideo:
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },

  {
    name: "Carlos",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/CARLOS_RODRIGUEZ_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
    strengths:
      "Buen control del ritmo del juego, capacidad asociativa y visión entre líneas.",
    improvements:
      "Aumentar impacto en último tercio y verticalidad ofensiva.",
    strengthVideo:
      "https://www.youtube.com/embed/ysz5S6PUM-U",
    improvementVideo:
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },

  {
    name: "Álvaro Ginés",
    position: "Delantero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ALVARO_GINES_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
    strengths:
      "Buen ataque al espacio, capacidad de finalización y movilidad ofensiva.",
    improvements:
      "Seguir afinando lectura en apoyos y continuidad tras pérdida.",
    strengthVideo:
      "https://www.youtube.com/embed/ysz5S6PUM-U",
    improvementVideo:
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
  },
];

export default function Page() {
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  const filteredPlayers = useMemo(() => {
    return players.filter((player) =>
      player.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <main className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-6 text-3xl font-bold">
          Plantilla Castilla
        </h1>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar jugador..."
          className="mb-8 w-full rounded-xl border p-3"
        />

        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredPlayers.map((player) => (
            <button
              key={player.name}
              onClick={() => setSelectedPlayer(player)}
              className="rounded-2xl border bg-white p-4 text-left shadow hover:shadow-lg transition"
            >
              <img
                src={player.photo}
                alt={player.name}
                className="mb-4 h-72 w-full rounded-xl object-cover"
              />

              <h2 className="text-lg font-semibold">
                {player.name}
              </h2>

              <p className="text-gray-600">
                {player.position}
              </p>
            </button>
          ))}
        </div>
      </div>

      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {selectedPlayer.name}
                </h2>

                <p className="text-gray-600">
                  {selectedPlayer.position}
                </p>
              </div>

              <button
                onClick={() => setSelectedPlayer(null)}
                className="text-2xl"
              >
                ✕
              </button>
            </div>

            <img
              src={selectedPlayer.photo}
              alt={selectedPlayer.name}
              className="mb-6 h-80 w-full rounded-xl object-cover"
            />

            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xl font-semibold">
                  Fortalezas
                </h3>

                <p className="mb-4 text-gray-700">
                  {selectedPlayer.strengths ||
                    DEFAULT_STRENGTH}
                </p>

                <iframe
                  className="aspect-video w-full rounded-xl"
                  src={
                    selectedPlayer.strengthVideo ||
                    DEFAULT_STRENGTH_VIDEO
                  }
                  allowFullScreen
                />
              </div>

              <div>
                <h3 className="mb-2 text-xl font-semibold">
                  Aspectos de mejora
                </h3>

                <p className="mb-4 text-gray-700">
                  {selectedPlayer.improvements ||
                    DEFAULT_IMPROVEMENT}
                </p>

                <iframe
                  className="aspect-video w-full rounded-xl"
                  src={
                    selectedPlayer.improvementVideo ||
                    DEFAULT_IMPROVEMENT_VIDEO
                  }
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}