"use client";

import { useState } from "react";
import ImportAvailability, {
  TrainingImport,
} from "@/components/session/ImportAvailability";

export default function ImportTrainingPage() {
  const [trainingImport, setTrainingImport] =
    useState<TrainingImport | null>(null);

  return (
    <div className="mx-auto max-w-5xl p-8 space-y-6">
      <h1 className="text-3xl font-bold">
        Importador IA
      </h1>

      <p className="text-muted-foreground">
        Sube la imagen del entrenamiento y Gemini detectará automáticamente la
        disponibilidad de todos los jugadores.
      </p>

      <ImportAvailability
        onImport={(data) => {
          console.log(data);
          setTrainingImport(data);
        }}
      />

      {trainingImport && (
        <div className="rounded-xl border p-6">
          <h2 className="font-semibold mb-4">
            Resultado
          </h2>

          <pre className="overflow-auto rounded-lg bg-muted p-4 text-sm">
            {JSON.stringify(trainingImport, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}