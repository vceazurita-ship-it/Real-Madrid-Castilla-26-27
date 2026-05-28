'use client'

import { useMemo, useState } from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import data from '@/data/BASE_DATOS_ABP.json'

const POSICIONES = ['Defensa', 'Medio campo', 'Delantera']

const METRICAS = [
  'Ataque xG',
  'Finalización xG',
  'Pases xA',
  'Regates',
  'Defensa',
  'Construcción',
]

function percentile(values: number[], v: number) {
  const sorted = [...values].sort((a, b) => a - b)
  const idx = sorted.findIndex((x) => x >= v)
  if (idx === -1) return 100
  return Math.round((idx / sorted.length) * 100)
}

function getJugador(nombre: string) {
  return data.find((j: any) => j.Jugador === nombre)
}

function radarData(jugador: any) {
  if (!jugador) return []

  return METRICAS.map((m) => {
    const values = data
      .filter((x: any) => x.Posición === jugador.Posición)
      .map((x: any) => Number(x[m]) || 0)

    return {
      metrica: m,
      valor: percentile(values, Number(jugador[m]) || 0),
    }
  })
}

function nombresPorPosicion(pos: string) {
  return data
    .filter((j: any) => j.Posición === pos)
    .map((j: any) => j.Jugador)
    .sort()
}

function RadarJugador({
  nombre,
  color,
}: {
  nombre: string
  color: string
}) {
  const jugador = getJugador(nombre)
  const valores = radarData(jugador)

  if (!jugador) return null

  return (
    <div className="bg-white rounded-2xl shadow p-5 h-[430px] flex flex-col">
      <div className="mb-3">
        <h2 className="text-xl font-semibold">{nombre}</h2>
        <p className="text-sm text-gray-500">{jugador.Posición}</p>
      </div>

      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={valores}>
            <PolarGrid />
            <PolarAngleAxis
              dataKey="metrica"
              tick={{ fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
            />
            <Radar
              dataKey="valor"
              stroke={color}
              fill={color}
              fillOpacity={0.35}
            />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function BloquePosicion({ posicion }: { posicion: string }) {
  const jugadores = nombresPorPosicion(posicion)
  const [nombre, setNombre] = useState(jugadores[0] || '')

  const jugador = getJugador(nombre)
  const valores = radarData(jugador)

  return (
    <div className="bg-white rounded-2xl shadow px-5 pt-4 pb-3 h-[420px] flex flex-col">
      <div className="mb-2">
        <h3 className="text-lg font-semibold">{posicion}</h3>
      </div>

      <div className="mb-2">
        <select
          className="w-full rounded-lg border px-3 py-2 text-sm"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        >
          {jugadores.map((j) => (
            <option key={j}>{j}</option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={valores}>
            <PolarGrid />
            <PolarAngleAxis
              dataKey="metrica"
              tick={{ fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
            />
            <Radar
              dataKey="valor"
              stroke="#2563eb"
              fill="#2563eb"
              fillOpacity={0.3}
            />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function Page() {
  const defensas = nombresPorPosicion('Defensa')
  const [izquierda, setIzquierda] = useState(defensas[0] || '')
  const [derecha, setDerecha] = useState(defensas[1] || '')

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-[1700px] space-y-6">

        {/* perfiles superiores */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <select
              className="mb-3 w-full rounded-lg border px-3 py-2"
              value={izquierda}
              onChange={(e) => setIzquierda(e.target.value)}
            >
              {defensas.map((j) => (
                <option key={j}>{j}</option>
              ))}
            </select>

            <RadarJugador
              nombre={izquierda}
              color="#2563eb"
            />
          </div>

          <div>
            <select
              className="mb-3 w-full rounded-lg border px-3 py-2"
              value={derecha}
              onChange={(e) => setDerecha(e.target.value)}
            >
              {defensas.map((j) => (
                <option key={j}>{j}</option>
              ))}
            </select>

            <RadarJugador
              nombre={derecha}
              color="#dc2626"
            />
          </div>
        </div>

        {/* línea inferior */}
        <div className="grid grid-cols-3 gap-6">
          {POSICIONES.map((p) => (
            <BloquePosicion
              key={p}
              posicion={p}
            />
          ))}
        </div>
      </div>
    </main>
  )
}