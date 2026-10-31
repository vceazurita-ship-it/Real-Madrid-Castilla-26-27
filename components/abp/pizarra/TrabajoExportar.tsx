"use client";

/*
| Atiende las exportaciones de la pizarra de ABP desde el layout raíz
| (31/10/2026): «Exportar todo», «Solo documentos», PowerPoint, PDF y el vídeo
| de cada jugada siguen aunque se cambie de pantalla. Cada encargo monta su
| propio componente en modo trabajo, con la foto de la pizarra del momento en
| que se pulsó, y se retira solo al terminar. Ver `lib/abp/trabajo-exportar.ts`.
*/

import { useSyncExternalStore } from "react";

import { ExportaPizarra } from "@/components/abp/pizarra/ExportaPizarra";
import { ExportaTodo } from "@/components/abp/pizarra/ExportaTodo";
import { VideoJugada } from "@/components/abp/pizarra/VideoJugada";
import { trabajoExportar } from "@/lib/abp/trabajo-exportar";

const VACIO = { encargos: [], rotulos: {} };

export function TrabajoExportar() {
  const { encargos } = useSyncExternalStore(trabajoExportar.suscribe, trabajoExportar.foto, () => VACIO);

  return (
    <>
      {encargos.map((e) => {
        if (e.tipo === "todo") return <ExportaTodo key={e.id} trabajo={{ id: e.id, conVideos: e.conVideos, soloVideos: e.soloVideos }} {...e.datos} />;

        if (e.tipo === "pizarra") {
          return <ExportaPizarra key={e.id} trabajo={{ id: e.id, formato: e.formato, porFases: e.porFases }} {...e.datos} />;
        }

        return <VideoJugada key={e.id} trabajo={{ id: e.id, destino: e.destino }} {...e.datos} />;
      })}
    </>
  );
}
