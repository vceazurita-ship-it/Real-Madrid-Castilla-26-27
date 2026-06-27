"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Player } from "@/types/player";

const CSV_URL =
"https://docs.google.com/spreadsheets/d/e/2PACX-1vTkdtHaPU7QWiWPxOWJYkfpD-RvFF3dsnRDGVjh9e3rkoA9pDQFNp6WPNRZafrAMNfe8cLlBqkf9S9k/pub?gid=205498392&single=true&output=csv";

export function usePlayers() {

  const [players,setPlayers]=useState<Player[]>([]);

  const [loading,setLoading]=useState(true);

  useEffect(()=>{

    Papa.parse(CSV_URL,{

      download:true,

      header:true,

      complete:(results:any)=>{

        const plantilla=(results.data||[])
        .filter((p:any)=>p.ACTIVO==="TRUE")
        .map((p:any)=>({

          id:p.ID_JUGADOR,

          nombre:p.NOMBRE,

          posicion:p.POSICION,

          dorsal:Number(p.DORSAL)||undefined,

          foto:
            p.FOTO_URL ||
            "/jugador.png",

          licencia:
            p.LICENCIA || "RMCF Castilla",

          estado:
            p.ESTADO || "DISPONIBLE",

          activo:true,

          hudl:p.HUDL_PERFIL_URL

        }));

        setPlayers(plantilla);

        setLoading(false);

      }

    });

  },[]);

  const disponibles=useMemo(

()=>players.filter(p=>p.estado==="DISPONIBLE"),

[players]

);

  const porteros=players.filter(
p=>p.posicion.toUpperCase().includes("PORTERO")
);

const defensas=players.filter(p=>

p.posicion.includes("LATERAL") ||

p.posicion.includes("CENTRAL")

);

const centrocampistas=players.filter(p=>

["6","8","10"].includes(p.posicion)

);

const extremos=players.filter(p=>

["7","11"].includes(p.posicion)

);

const delanteros=players.filter(p=>

p.posicion==="9"

);

const lesionados=players.filter(
p=>p.estado==="LESIONADO"
);

const primerEquipo=players.filter(
p=>p.estado==="PRIMER EQUIPO"
);

const seleccion=players.filter(
p=>p.estado==="SELECCIÓN"
);

return{

players,

loading,

disponibles,

lesionados,

primerEquipo,

seleccion,

porteros,

defensas,

centrocampistas,

extremos,

delanteros

}

}