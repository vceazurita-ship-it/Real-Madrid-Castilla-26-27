"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface TrainingPlayer {
  detected: string;
  official: string | null;
  confidence: number;
  photo: string;
}

export interface PendingPlayer {
  name: string;
  photo: string;
}

export interface TrainingImport {
  available: TrainingPlayer[];
  injury: TrainingPlayer[];
  promotion: TrainingPlayer[];
  nationalTeam: TrainingPlayer[];
  others: TrainingPlayer[];

  pendingPlayers: PendingPlayer[];
}

type Props = {
  onImport: (data: TrainingImport) => void;
};

export default function ImportAvailability({ onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleSelect = () => {
    inputRef.current?.click();
  };

  const handleFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona una imagen válida.");
      return;
    }

    setFileName(file.name);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/training-import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("No se pudo analizar la imagen.");
      }

      const data: TrainingImport = await response.json();

      onImport(data);

      toast.success("Disponibilidad importada correctamente.");
    } catch (error) {
      console.error(error);

      toast.error("Ha ocurrido un error al analizar la imagen.");
    } finally {
      setLoading(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleFile}
      />

      <Button
        type="button"
        onClick={handleSelect}
        disabled={loading}
        className="w-fit"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analizando...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Importar disponibilidad
          </>
        )}
      </Button>

      {fileName && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <ImageIcon className="h-4 w-4" />
          <span className="truncate">{fileName}</span>
        </div>
      )}

    </div>
  );
}