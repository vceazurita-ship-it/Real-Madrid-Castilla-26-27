"use client";

/*
| SUS GOLES EN EL CAMPO Y EN VÍDEO (18/11/2026, petición del analista: «el
| campograma de goles y el ver sus goles en vídeo… me parece bastante chulo y
| visual, debe ser de lo primero a ver de esa sección»).
|
| Lo primero de /analisis-goles: los goles del equipo elegido (a favor o en
| contra) en el campograma de remates de Opta y, pegado, el reproductor «de
| seguido» (`GolesDeSeguido`, el mismo de «Sus goles en vídeo»). Pinchar un gol
| en el campo lo reproduce. Juntos se quedan los filtros que tenía cada uno:
| en jugada o a balón parado y los últimos 3 o 5 partidos (de «Sus goles en
| vídeo»), y «Todos los remates», el partido y los enlaces a Opta y Wyscout
| (del campograma). Sirve para el Castilla y para cualquier rival: los datos
| salen como «En el campo» (useOpta + useRemates) y el equipo se casa por
| nombre con `casaEquipo`.
*/

import { useMemo, useState } from "react";

import { Botonera } from "@/app/opta/_piezas/comun";
import { equiposDe, useRemates } from "@/app/opta/_piezas/eventos";
import { GolesDeSeguido, type PedidoGol } from "@/app/opta/_piezas/GolesDeSeguido";
import { MapaRemates } from "@/app/opta/_piezas/Remates";
import { useOpta, type DatosOpta } from "@/app/opta/_piezas/useOpta";
import { Lamina, TituloConclusion } from "@/components/ui/VistaVisual";
import { CASTILLA_OPTA } from "@/lib/opta";
import { casaEquipo, type Remate } from "@/lib/opta-eventos";
import type { LadoGoles } from "@/lib/rivals/goles-en-video";

type Tipo = "todos" | "jugada" | "abp";
type Ultimos = "todos" | "3" | "5";

/** Situaciones de Opta que son juego (el resto —córner, faltas, banda, penalti— es balón parado). Igual que en «Sus goles en vídeo». */
const EN_JUGADA = new Set(["Open play", "Fastbreak/Counter"]);
const tipoDe = (r: Remate): Exclude<Tipo, "todos"> => (EN_JUGADA.has(r.situacion) ? "jugada" : "abp");
/** Dentro del área, en las coordenadas de Opta (0-100, atacando hacia x = 100). */
const enArea = (r: Remate) => r.x >= 83 && r.y >= 21.1 && r.y <= 78.9;

const Esqueleto = () => <div className="h-72 animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label="Cargando los goles de Opta" />;

export function GolesCampoVideo({ equipo, esCastilla, nombre, ladoInicial = "favor" }: { equipo: string; esCastilla: boolean; nombre: string; ladoInicial?: LadoGoles }) {
  const { datos } = useOpta();

  if (!datos) return <Esqueleto />;

  return <Cuerpo datos={datos} equipo={equipo} esCastilla={esCastilla} nombre={nombre} ladoInicial={ladoInicial} />;
}

function Cuerpo({ datos, equipo, esCastilla, nombre, ladoInicial }: { datos: DatosOpta; equipo: string; esCastilla: boolean; nombre: string; ladoInicial: LadoGoles }) {
  const { remates, cargando, hay } = useRemates(datos);
  const [lado, setLado] = useState<LadoGoles>(ladoInicial);
  const [tipoPedido, setTipo] = useState<Tipo>("todos");
  const [ultimos, setUltimos] = useState<Ultimos>("todos");
  const [pedido, setPedido] = useState<PedidoGol | null>(null);

  const teamId = useMemo(() => {
    if (!datos.equipos.length) return "";
    if (esCastilla) return CASTILLA_OPTA;
    return casaEquipo(equipo, equiposDe(datos)) ?? "";
  }, [datos, equipo, esCastilla]);

  const suyos = useMemo(() => remates.filter((r) => teamId && (r.teamId === teamId || r.rivalId === teamId)), [remates, teamId]);
  /* Sus partidos, del más reciente al más antiguo (por los remates de los dos lados: un 0-0 también cuenta). */
  const partidos = useMemo(() => {
    const fecha = new Map<string, string>();
    for (const r of suyos) if ((fecha.get(r.partido) ?? "") < r.fecha) fecha.set(r.partido, r.fecha);
    return [...fecha.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([p]) => p);
  }, [suyos]);
  const recientes = useMemo(() => (ultimos === "todos" ? suyos : suyos.filter((r) => partidos.slice(0, Number(ultimos)).includes(r.partido))), [suyos, partidos, ultimos]);
  const golesFavor = recientes.filter((r) => r.gol && r.teamId === teamId).length;
  const golesContra = recientes.filter((r) => r.gol && r.rivalId === teamId).length;
  const delLado = useMemo(() => recientes.filter((r) => (lado === "favor" ? r.teamId === teamId : r.rivalId === teamId)), [recientes, lado, teamId]);
  const enJugada = delLado.filter((r) => r.gol && tipoDe(r) === "jugada").length;
  const aBalonParado = delLado.filter((r) => r.gol).length - enJugada;
  /* Un filtro que se quedaría vacío no se aplica: se ven todos. */
  const tipo: Tipo = (tipoPedido === "abp" && aBalonParado === 0) || (tipoPedido === "jugada" && enJugada === 0) ? "todos" : tipoPedido;
  const delTipo = useMemo(() => (tipo === "todos" ? delLado : delLado.filter((r) => tipoDe(r) === tipo)), [delLado, tipo]);
  /* Memorizado: una lista nueva en cada pintado rehacía las tomas y volvía a cargar el corte que se estaba viendo. */
  const goles = useMemo(() => delTipo.filter((r) => r.gol), [delTipo]);

  if (cargando) return <Esqueleto />;
  if (!hay || !teamId || !suyos.some((r) => r.gol)) return null;

  const nPartidos = partidos.length;
  const cuantos = ultimos === "todos" ? nPartidos : Math.min(Number(ultimos), nPartidos);
  const deArea = goles.filter(enArea).length;
  const deJugadaVistos = goles.filter((r) => tipoDe(r) === "jugada").length;
  const quien = esCastilla ? "El Castilla" : nombre;
  const verbo = lado === "favor" ? "marca" : "encaja";
  /* El titular: cuántos, desde dónde y cómo llegan; la base, en la fuente. */
  const titular = goles.length
    ? `${quien} ${verbo} ${goles.length} ${goles.length === 1 ? "gol" : "goles"}${tipo === "jugada" ? " en jugada" : tipo === "abp" ? " a balón parado" : ""}${
        goles.length >= 2 ? `: ${deArea === goles.length ? "todos" : `${deArea} de ${goles.length}`} desde dentro del área${tipo === "todos" ? ` y ${deJugadaVistos === goles.length ? "todos" : deJugadaVistos} en jugada` : ""}` : ""
      }`
    : `${quien} no ${verbo} goles${tipo === "jugada" ? " en jugada" : tipo === "abp" ? " a balón parado" : ""} en ${cuantos === nPartidos ? "estos partidos" : `sus últimos ${cuantos}`}`;
  const tituloVideo = `${lado === "favor" ? (esCastilla ? "Nuestros goles" : `Goles de ${nombre}`) : esCastilla ? "Los goles que encajamos" : `Goles que encaja ${nombre}`}${tipo === "jugada" ? " en jugada" : tipo === "abp" ? " a balón parado" : ""}`;

  return (
    <Lamina>
      <TituloConclusion
        pregunta={lado === "favor" ? "¿Desde dónde marca y cómo son sus goles?" : "¿Desde dónde le marcan y cómo?"}
        fuente={`Opta · ${cuantos} ${cuantos === 1 ? "partido" : "partidos"}${ultimos === "todos" ? ", esta temporada" : ", los últimos"}${cuantos < 15 ? " · tendencia" : ""} · los goles en propia puerta no son remates y no salen`}
      >
        {titular}
      </TituloConclusion>

      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
        <Botonera
          etiqueta="Los que marca o los que encaja"
          valor={lado}
          alCambiar={(v) => {
            setLado(v);
            setTipo("todos");
            setPedido(null);
          }}
          opciones={[
            { clave: "favor", nombre: `${esCastilla ? "Nuestros goles" : "Sus goles"} (${golesFavor})` },
            { clave: "contra", nombre: `${esCastilla ? "Los que encajamos" : "Los que encaja"} (${golesContra})` },
          ]}
        />
        {enJugada > 0 && aBalonParado > 0 && (
          <Botonera
            etiqueta="En jugada o a balón parado"
            valor={tipo}
            alCambiar={(v) => (setTipo(v), setPedido(null))}
            opciones={[
              { clave: "todos", nombre: "Todos" },
              { clave: "jugada", nombre: `En jugada (${enJugada})` },
              { clave: "abp", nombre: `A balón parado (${aBalonParado})` },
            ]}
          />
        )}
        {nPartidos > 3 && (
          <Botonera
            etiqueta="Qué partidos"
            valor={ultimos}
            alCambiar={(v) => (setUltimos(v), setPedido(null))}
            opciones={[
              { clave: "todos", nombre: "Temporada" },
              { clave: "3", nombre: "Últimos 3" },
              ...(nPartidos > 5 ? [{ clave: "5" as const, nombre: "Últimos 5" }] : []),
            ]}
          />
        )}
      </div>

      {/* Campo a la izquierda y vídeo a la derecha; en el móvil, el campo arriba y el vídeo debajo. */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <MapaRemates
            key={`${teamId}-${lado}-${tipo}-${ultimos}`}
            remates={delTipo}
            enContra={lado === "contra"}
            soloGolesInicial
            listaGoles={false}
            alPincharGol={(g) => setPedido({ gol: g })}
            maxAlto={420}
            ariaLabel={`Goles ${lado === "favor" ? "de" : "contra"} ${esCastilla ? "el Castilla" : nombre} en el campo`}
          />
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">En vídeo · pincha un gol en el campo o en la lista</p>
          {goles.length ? (
            <GolesDeSeguido key={`seguido-${teamId}-${lado}-${tipo}-${ultimos}`} goles={goles} titulo={tituloVideo} conLista pedido={pedido} />
          ) : (
            <p className="text-[13px] text-white/60">{titular}.</p>
          )}
        </div>
      </div>
    </Lamina>
  );
}
