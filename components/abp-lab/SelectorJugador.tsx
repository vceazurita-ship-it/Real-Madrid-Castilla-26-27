"use client";

/**
 * QUIÉN HACE CADA PAPEL, CON SU CARA (laboratorio de ABP, 24/10/2026).
 *
 * El selector de jugador de la lista de papeles: la plantilla del Castilla
 * con foto, dorsal y puesto y, si Wyscout lo da, la altura y el porcentaje de
 * duelos aéreos ganados. Para los papeles de remate se ordena por altura.
 * `repartoPorAltura` propone los dueños de los papeles de remate que aún no
 * lo tienen: los más altos, sin repetir a nadie ni tocar lo ya puesto.
 */

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { iniciales, type JugadorLab } from "@/components/abp-lab/comun";
import type { PerfilAereo } from "@/hooks/useContextoLab";
import type { Papel, Rol } from "@/lib/abp-lab/modelo";

const POR_ALTURA: Papel[] = ["rematador", "portero", "bloqueador", "senuelo"];

const esPortero = (j: JugadorLab) => /portero|^po?r?$|^gk$/i.test(j.posicion.trim());

const coma = (v: number) => v.toFixed(0);

/** Los papeles de remate sin dueño, para los más altos que no tienen papel. */
export function repartoPorAltura(roles: Rol[], jugadores: JugadorLab[], aereo: Map<string, PerfilAereo>) {
  const usados = new Set(roles.map((r) => r.jugador).filter(Boolean));

  const libres = jugadores
    .filter((j) => !usados.has(j.id) && !esPortero(j) && aereo.get(j.id)?.altura)
    .sort((a, b) => (aereo.get(b.id)?.altura ?? 0) - (aereo.get(a.id)?.altura ?? 0) || (aereo.get(b.id)?.aereoPct ?? 0) - (aereo.get(a.id)?.aereoPct ?? 0));

  const huecos = roles
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !r.jugador && POR_ALTURA.includes(r.papel))
    .sort((a, b) => POR_ALTURA.indexOf(a.r.papel) - POR_ALTURA.indexOf(b.r.papel));

  const nuevos = roles.map((r) => ({ ...r }));

  let cambios = 0;

  huecos.forEach(({ i }, n) => {
    const j = libres[n];

    if (!j) return;

    nuevos[i] = { ...nuevos[i], jugador: j.id };
    cambios += 1;
  });

  return { roles: nuevos, cambios };
}

function Cara({ j, tam = 32 }: { j?: JugadorLab; tam?: number }) {
  if (!j) return <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full border border-dashed border-white/25 text-[11px] text-white/40" style={{ width: tam, height: tam }} />;

  return j.foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={j.foto} alt="" className="shrink-0 rounded-full bg-white/10 object-cover object-top" style={{ width: tam, height: tam }} loading="lazy" />
  ) : (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full bg-[#C8A96B] text-[11px] font-black text-black" style={{ width: tam, height: tam }}>
      {iniciales(j.nombre)}
    </span>
  );
}

export function SelectorJugador({
  valor,
  jugadores,
  porId,
  aereo,
  ocupados,
  papel,
  onElige,
}: {
  valor: string;
  jugadores: JugadorLab[];
  porId: Map<string, JugadorLab>;
  aereo: Map<string, PerfilAereo>;
  /** Los que ya tienen otro papel en la rutina. */
  ocupados: Set<string>;
  papel: Papel;
  onElige: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  const [busca, setBusca] = useState("");

  const actual = valor ? porId.get(valor) : undefined;

  const perfil = valor ? aereo.get(valor) : undefined;

  const porAltura = POR_ALTURA.includes(papel);

  const lista = useMemo(() => {
    const q = busca
      .trim()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

    const filtrados = jugadores.filter(
      (j) =>
        !q ||
        `${j.nombre} ${j.dorsal ?? ""} ${j.posicion}`
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .includes(q),
    );

    return porAltura ? [...filtrados].sort((a, b) => (aereo.get(b.id)?.altura ?? 0) - (aereo.get(a.id)?.altura ?? 0)) : filtrados;
  }, [jugadores, busca, porAltura, aereo]);

  /* Escape cierra el selector y no el estudio de debajo. */
  useEffect(() => {
    if (!abierto) return;

    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      e.stopPropagation();
      e.preventDefault();
      setAbierto(false);
    };

    window.addEventListener("keydown", tecla, true);

    return () => window.removeEventListener("keydown", tecla, true);
  }, [abierto]);

  const elige = (id: string) => {
    onElige(id);
    setAbierto(false);
    setBusca("");
  };

  return (
    <div className="min-w-0">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Jugador</span>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5 text-left transition hover:border-[#C8A96B]/50"
      >
        <Cara j={actual} tam={26} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-white/90">{actual ? actual.nombre : valor ? "Ya no está en la plantilla" : "Sin dueño"}</span>
          {perfil?.altura ? <span className="block text-[10.5px] text-white/45">{perfil.altura} cm</span> : null}
        </span>
        <ChevronDown size={14} className="shrink-0 text-white/40" />
      </button>

      {abierto && (
        <div className="modal-veil fixed inset-0 z-[70] flex items-end justify-center sm:items-center" onClick={() => setAbierto(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Elegir jugador"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#11161C] shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-center gap-2 border-b border-white/10 p-3">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Buscar jugador</span>
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
                <input
                  autoFocus
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nombre, dorsal o puesto"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#C8A96B]/50"
                />
              </label>
              <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="rounded-lg p-2 text-white/55 transition hover:text-white">
                <X size={16} />
              </button>
            </div>
            {porAltura && <p className="px-3 pt-2 text-[11px] text-white/45">Ordenados por altura (Wyscout).</p>}
            <ul className="min-h-0 flex-1 overflow-y-auto p-2">
              <li>
                <button type="button" onClick={() => elige("")} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.05]">
                  <Cara tam={36} />
                  <span className="text-[13px] text-white/70">Sin dueño</span>
                  {!valor && <Check size={15} className="ml-auto text-[#C8A96B]" />}
                </button>
              </li>
              {lista.map((j) => {
                const p = aereo.get(j.id);

                const ocupado = ocupados.has(j.id);

                return (
                  <li key={j.id}>
                    <button type="button" onClick={() => elige(j.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.05]">
                      <Cara j={j} tam={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-white/90">
                          {j.dorsal !== undefined ? `${j.dorsal} · ` : ""}
                          {j.nombre}
                        </span>
                        <span className="block truncate text-[11px] text-white/45">
                          {[j.posicion, p?.altura ? `${p.altura} cm` : "", p?.aereoPct !== null && p?.aereoPct !== undefined ? `${coma(p.aereoPct)} % aéreos ganados` : "", ocupado ? "ya tiene papel" : ""].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {valor === j.id && <Check size={15} className="shrink-0 text-[#C8A96B]" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
